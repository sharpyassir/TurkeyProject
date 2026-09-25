import { Logger } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { ApplicationFailure, Context } from '@temporalio/activity';
import type { ServerStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { HYPERVISOR_DRIVER, HypervisorDriver } from '../drivers/hypervisor.driver';
import { AgentJobError } from '../drivers/proxmox.driver';
import { SchedulerService } from '../modules/scheduler/scheduler.service';
import { IpsService } from '../modules/network/ips.service';
import { FirewallsService } from '../modules/network/firewalls.service';
import { EventsService } from '../modules/events/events.service';
import { ApiError } from '../common/errors/api-error';

/**
 * Activities are the only place workflows touch the database or the hypervisor.
 * Every activity is idempotent by serverId so Temporal can retry it safely.
 */
export interface Activities {
  setStatus(serverId: string, status: ServerStatus, message?: string): Promise<void>;
  setImage(serverId: string, imageId: string): Promise<void>;
  placeServer(serverId: string, avoid: string[]): Promise<void>;
  reserveIp(serverId: string): Promise<void>;
  createVm(serverId: string): Promise<void>;
  waitForBoot(serverId: string): Promise<void>;
  applyFirewall(serverId: string): Promise<void>;
  startMeter(serverId: string): Promise<void>;
  compensateCreate(serverId: string): Promise<void>;
  powerOp(serverId: string, op: 'start' | 'stop' | 'reboot', force: boolean): Promise<void>;
  isRunning(serverId: string): Promise<boolean>;
  syncStatusFromHypervisor(serverId: string, message: string): Promise<void>;
  resizeVm(serverId: string, sizeId: string): Promise<void>;
  deleteVm(serverId: string): Promise<void>;
  finalizeDelete(serverId: string): Promise<void>;
  createSnapshotRecord(serverId: string, name: string): Promise<string>;
  snapshotVm(serverId: string, snapshotId: string): Promise<void>;
  failSnapshot(snapshotId: string, message: string): Promise<void>;
  deleteSnapshotVm(snapshotId: string): Promise<void>;
  completeAction(actionId: string): Promise<void>;
  failAction(actionId: string, message: string): Promise<void>;
  emit(name: string, serverId: string, payload: Record<string, unknown>): Promise<void>;
}

export function createActivities(app: INestApplicationContext): Activities {
  const log = new Logger('activities');
  const prisma = app.get(PrismaService);
  const driver = app.get<HypervisorDriver>(HYPERVISOR_DRIVER);
  const scheduler = app.get(SchedulerService);
  const ips = app.get(IpsService);
  const firewalls = app.get(FirewallsService);
  const events = app.get(EventsService);

  /** Loads a server with everything the driver needs. Throws non-retryable if gone. */
  async function load(serverId: string) {
    const s = await prisma.server.findUnique({ where: { id: serverId }, include: { host: true, image: true, size: true, publicIps: { include: { block: true } }, project: { include: { team: true } } } });
    if (!s) throw nonRetryable(`server ${serverId} no longer exists`);
    return s;
  }

  function hostRef(s: { host: { driverRef: string } | null }) {
    if (!s.host) throw nonRetryable('server has no host');
    return s.host.driverRef;
  }

  function wrap<T>(p: Promise<T>): Promise<T> {
    // Map driver errors so Temporal retries only what the agent says is retryable.
    return p.catch((err) => {
      if (err instanceof AgentJobError && !err.retryable) throw nonRetryable(err.message);
      if (err instanceof ApiError) throw nonRetryable(err.message);
      throw err;
    });
  }

  return {
    async setStatus(serverId, status, message) {
      await prisma.server.update({ where: { id: serverId }, data: { status, statusMessage: message ?? null } });
    },

    async setImage(serverId, imageId) {
      await prisma.server.update({ where: { id: serverId }, data: { imageId } });
    },

    async placeServer(serverId, avoid) {
      const s = await load(serverId);
      if (s.hostId) return; // already placed (retry)
      const placement = await wrap(scheduler.place({ regionId: s.regionId, vcpu: s.vcpu, memoryMb: s.memoryMb, diskGb: s.diskGb, avoidServerIds: avoid, family: s.size.family }));
      await prisma.server.update({ where: { id: serverId }, data: { hostId: placement.hostId } });
      log.log(`placed ${serverId} on host ${placement.hostId}`);
    },

    async reserveIp(serverId) {
      const s = await load(serverId);
      if (s.publicIps.length) return;
      await wrap(ips.reserve(s.regionId, s.projectId, serverId));
    },

    async createVm(serverId) {
      const s = await load(serverId);
      if (s.driverRef) return; // VM already created (retry)
      const keys = await prisma.sshKey.findMany({ where: { id: { in: s.sshKeyIds } } });
      const ip = s.publicIps[0];
      const handle = await wrap(
        driver.createVm(hostRef(s), {
          serverId: s.id,
          name: s.name,
          hostname: s.name,
          vcpu: s.vcpu,
          memoryMb: s.memoryMb,
          diskGb: s.diskGb,
          imageRef: s.image.driverRef ?? s.image.id,
          sshKeys: keys.map((k) => k.publicKey),
          userData: s.userData ?? undefined,
          networkRef: `vpc-${s.projectId}`,
          publicIp: ip ? { address: ip.address, gateway: ip.block.gateway, prefix: IpsService.prefixOf(ip.block.cidr) } : undefined,
        }),
      );
      await prisma.server.update({ where: { id: serverId }, data: { driverRef: handle.vmRef, privateIp: handle.privateIp } });
    },

    async waitForBoot(serverId) {
      const s = await load(serverId);
      if (!s.driverRef) throw nonRetryable('waitForBoot before createVm');
      const heartbeat = setInterval(() => Context.current().heartbeat(), 20_000);
      try {
        const status = await wrap(driver.waitForBoot(hostRef(s), s.driverRef, 10 * 60_000));
        if (status.power !== 'running') throw new Error(`VM is ${status.power} after boot`);
      } finally {
        clearInterval(heartbeat);
      }
    },

    async applyFirewall(serverId) {
      const s = await load(serverId);
      if (!s.driverRef) return;
      await wrap(driver.applyFirewall(hostRef(s), s.driverRef, await firewalls.effectiveRules(serverId)));
    },

    async startMeter(serverId) {
      await prisma.server.updateMany({ where: { id: serverId, meteredSince: null }, data: { meteredSince: new Date() } });
    },

    async compensateCreate(serverId) {
      const s = await prisma.server.findUnique({ where: { id: serverId }, include: { host: true } });
      if (!s) return;
      if (s.driverRef && s.host) {
        await driver.deleteVm(s.host.driverRef, s.driverRef).catch((e) => log.warn(`compensate: deleteVm ${serverId}: ${e.message}`));
      }
      await ips.releaseForServer(serverId);
      if (s.hostId) await scheduler.release(s.hostId, s);
      await prisma.server.update({ where: { id: serverId }, data: { driverRef: null, hostId: null, meteredSince: null } });
    },

    async powerOp(serverId, op, force) {
      const s = await load(serverId);
      if (!s.driverRef) throw nonRetryable('server has no VM');
      const h = hostRef(s);
      if (op === 'start') await wrap(driver.startVm(h, s.driverRef));
      if (op === 'stop') await wrap(driver.stopVm(h, s.driverRef, { force }));
      if (op === 'reboot') await wrap(driver.rebootVm(h, s.driverRef));
    },

    async isRunning(serverId) {
      const s = await load(serverId);
      if (!s.driverRef) return false;
      return (await driver.getVmStatus(hostRef(s), s.driverRef)).power === 'running';
    },

    async syncStatusFromHypervisor(serverId, message) {
      const s = await load(serverId);
      let status: ServerStatus = 'failed';
      if (s.driverRef && s.host) {
        const st = await driver.getVmStatus(s.host.driverRef, s.driverRef).catch(() => ({ power: 'unknown' as const }));
        if (st.power === 'running') status = 'active';
        else if (st.power === 'stopped') status = 'off';
      }
      await prisma.server.update({ where: { id: serverId }, data: { status, statusMessage: message } });
    },

    async resizeVm(serverId, sizeId) {
      const s = await load(serverId);
      const size = await prisma.size.findUniqueOrThrow({ where: { id: sizeId } });
      if (!s.driverRef) throw nonRetryable('server has no VM');
      await wrap(driver.resizeVm(hostRef(s), s.driverRef, size));
      if (s.hostId) {
        await scheduler.release(s.hostId, s);
        await prisma.host.update({ where: { id: s.hostId }, data: { usedVcpu: { increment: size.vcpu }, usedMemoryMb: { increment: size.memoryMb }, usedDiskGb: { increment: size.diskGb } } });
      }
      await prisma.server.update({ where: { id: serverId }, data: { sizeId, vcpu: size.vcpu, memoryMb: size.memoryMb, diskGb: size.diskGb } });
    },

    async deleteVm(serverId) {
      const s = await load(serverId);
      if (!s.driverRef || !s.host) return;
      await wrap(driver.deleteVm(s.host.driverRef, s.driverRef));
      await prisma.server.update({ where: { id: serverId }, data: { driverRef: null } });
    },

    async finalizeDelete(serverId) {
      const s = await load(serverId);
      await ips.releaseForServer(serverId);
      if (s.hostId) await scheduler.release(s.hostId, s);
      await prisma.server.update({ where: { id: serverId }, data: { status: 'deleted', deletedAt: new Date(), hostId: null, meteredSince: null } });
    },

    async createSnapshotRecord(serverId, name) {
      const s = await load(serverId);
      const existing = await prisma.snapshot.findFirst({ where: { serverId, name, status: 'pending' } });
      if (existing) return existing.id;
      return (await prisma.snapshot.create({ data: { projectId: s.projectId, serverId, name } })).id;
    },

    async snapshotVm(serverId, snapshotId) {
      const s = await load(serverId);
      if (!s.driverRef) throw nonRetryable('server has no VM');
      const heartbeat = setInterval(() => Context.current().heartbeat(), 20_000);
      try {
        const r = await wrap(driver.snapshotVm(hostRef(s), s.driverRef, snapshotId));
        await prisma.snapshot.update({ where: { id: snapshotId }, data: { status: 'available', driverRef: r.snapshotRef, sizeGb: r.sizeGb } });
      } finally {
        clearInterval(heartbeat);
      }
    },

    async failSnapshot(snapshotId, message) {
      await prisma.snapshot.update({ where: { id: snapshotId }, data: { status: 'failed' } }).catch(() => undefined);
      log.warn(`snapshot ${snapshotId} failed: ${message}`);
    },

    async deleteSnapshotVm(snapshotId) {
      const snap = await prisma.snapshot.findUnique({ where: { id: snapshotId }, include: { server: { include: { host: true } } } });
      if (!snap || snap.status === 'deleted') return;
      if (snap.driverRef && snap.server?.host) await wrap(driver.deleteSnapshot(snap.server.host.driverRef, snap.driverRef));
      await prisma.snapshot.update({ where: { id: snapshotId }, data: { status: 'deleted', deletedAt: new Date() } });
    },

    async completeAction(actionId) {
      await prisma.serverAction.update({ where: { id: actionId }, data: { status: 'completed', finishedAt: new Date() } });
    },

    async failAction(actionId, message) {
      await prisma.serverAction.update({ where: { id: actionId }, data: { status: 'failed', error: message.slice(0, 1000), finishedAt: new Date() } });
    },

    async emit(name, serverId, payload) {
      const s = await prisma.server.findUnique({ where: { id: serverId }, include: { project: { select: { teamId: true } } } });
      await events.emit(name, { serverId, name: s?.name, status: s?.status, ...payload }, { teamId: s?.project.teamId, resource: `server:${serverId}` });
    },
  };
}

function nonRetryable(message: string) {
  return ApplicationFailure.create({ message, type: 'NonRetryable', nonRetryable: true });
}
