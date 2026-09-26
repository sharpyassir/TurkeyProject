import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NatsService, Subjects } from '../../common/nats/nats.service';
import type { UsageEventV1 } from '../../drivers/agent-protocol';

/**
 * Ingests usage.v1 events from host agents into the UsageEvent hypertable, and runs
 * the control-plane fallback meter so an agent outage never makes a server free.
 */
@Injectable()
export class MeteringService {
  private readonly log = new Logger(MeteringService.name);

  constructor(private readonly prisma: PrismaService, private readonly nats: NatsService) {}

  listen() {
    this.nats.subscribe<UsageEventV1>(Subjects.usage, (e) => this.ingest([e]));
  }

  async ingest(events: UsageEventV1[]) {
    if (!events.length) return;
    await this.prisma.usageEvent.createMany({
      data: events.map((e) => ({
        at: minuteAligned(new Date(e.at)),
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        projectId: e.projectId,
        hostId: e.hostId,
        quantity: e.quantity,
        unit: e.unit,
        meta: (e.meta ?? {}) as Prisma.InputJsonValue,
      })),
      skipDuplicates: true, // agent + fallback meter may both report the same minute
    });
  }

  /**
   * Fallback meter: every minute, emit one server-minute for every active server and
   * one minute per assigned public IP / snapshot GB. Duplicates from agents are dropped
   * by the unique index on (resourceType, resourceId, at).
   */
  async tickFallback(now = new Date()) {
    const at = minuteAligned(now);
    const [servers, ips, snapshots, volumes] = await Promise.all([
      this.prisma.server.findMany({ where: { status: { in: ['active', 'off', 'rebooting', 'resizing', 'rebuilding'] }, meteredSince: { not: null } }, select: { id: true, projectId: true, hostId: true, backupsEnabled: true } }),
      this.prisma.publicIp.findMany({ where: { status: { in: ['assigned', 'reserved'] }, projectId: { not: null } }, select: { id: true, projectId: true } }),
      this.prisma.snapshot.findMany({ where: { status: 'available' }, select: { id: true, projectId: true, sizeGb: true } }),
    
      this.prisma.volume.findMany({ where: { status: { in: ['available', 'attaching', 'attached', 'detaching', 'resizing'] }, meteredSince: { not: null } }, select: { id: true, projectId: true, sizeGb: true } }),]);
    const data: Prisma.UsageEventCreateManyInput[] = [
      ...servers.map((s) => ({ at, resourceType: 'server' as const, resourceId: s.id, projectId: s.projectId, hostId: s.hostId, quantity: 1, unit: 'minute', meta: { source: 'fallback' } })),
      ...servers.filter((s) => s.backupsEnabled).map((s) => ({ at, resourceType: 'backup' as const, resourceId: s.id, projectId: s.projectId, hostId: s.hostId, quantity: 1, unit: 'minute', meta: { source: 'fallback' } })),
      ...ips.map((ip) => ({ at, resourceType: 'public_ip' as const, resourceId: ip.id, projectId: ip.projectId!, quantity: 1, unit: 'minute', meta: { source: 'fallback' } })),
      ...snapshots.map((sn) => ({ at, resourceType: 'snapshot' as const, resourceId: sn.id, projectId: sn.projectId, quantity: sn.sizeGb, unit: 'gb_minute', meta: { source: 'fallback' } })),
      ...volumes.map((v) => ({ at, resourceType: 'volume' as const, resourceId: v.id, projectId: v.projectId, quantity: v.sizeGb, unit: 'gb_minute', meta: { source: 'fallback' } })),
    ];
    if (!data.length) return 0;
    const r = await this.prisma.usageEvent.createMany({ data, skipDuplicates: true });
    this.log.debug(`fallback meter wrote ${r.count}/${data.length} events for ${at.toISOString()}`);
    return r.count;
  }
}

function minuteAligned(d: Date) {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000);
}
