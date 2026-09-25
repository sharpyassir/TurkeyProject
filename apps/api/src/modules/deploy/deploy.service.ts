import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';
import type { Actor } from '../../common/auth/actor';
import { IamService } from '../iam/iam.service';
import { EventsService } from '../events/events.service';
import { ServersService } from '../compute/servers.service';
import { FirewallsService } from '../network/firewalls.service';
import { renderDeployCloudInit } from './cloud-init';
import { CreateDeployDto } from './deploy.dto';

/**
 * Git Deploy: "link a repo, get a URL, push to redeploy". Built on a normal server so it
 * inherits quotas, spend checks, metering and the workflow engine — no separate PaaS.
 */
@Injectable()
export class DeployService {
  private readonly log = new Logger(DeployService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iam: IamService,
    private readonly events: EventsService,
    private readonly servers: ServersService,
    private readonly firewalls: FirewallsService,
  ) {}

  async list(actor: Actor, project?: string) {
    const p = await this.iam.resolveProject(actor, project);
    const rows = await this.prisma.deployment.findMany({ where: { projectId: p.id }, include: { server: { include: { publicIps: true } } }, orderBy: { createdAt: 'desc' } });
    return rows.map(present);
  }

  async get(actor: Actor, id: string) {
    const d = await this.prisma.deployment.findFirst({ where: { id, project: { teamId: actor.teamId } }, include: { server: { include: { publicIps: true } } } });
    if (!d) throw ApiError.notFound('deployment', id);
    return present(d);
  }

  async create(actor: Actor, dto: CreateDeployDto) {
    if (!/^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/[\w.-]+\/[\w.-]+?(\.git)?$/.test(dto.repoUrl)) {
      throw ApiError.invalid('repoUrl must be an https GitHub, GitLab or Bitbucket repository URL');
    }
    const project = await this.iam.resolveProject(actor, dto.project);
    const webhookSecret = 'whsec_' + randomBytes(24).toString('base64url');
    const vmSecret = randomBytes(24).toString('base64url');
    const name = dto.name ?? dto.repoUrl.split('/').pop()!.replace(/\.git$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // A firewall that also opens the redeploy hook port for the control plane.
    const fw = await this.firewalls.create(actor, project.id, {
      name: `deploy-${name}`,
      rules: [
        { direction: 'inbound', protocol: 'tcp', ports: '22', cidrs: ['0.0.0.0/0'] },
        { direction: 'inbound', protocol: 'tcp', ports: '80', cidrs: ['0.0.0.0/0'] },
        { direction: 'inbound', protocol: 'tcp', ports: '443', cidrs: ['0.0.0.0/0'] },
        { direction: 'inbound', protocol: 'tcp', ports: '9009', cidrs: [process.env.CONTROL_PLANE_CIDR ?? '0.0.0.0/0'], description: 'pgcloud redeploy hook' },
        { direction: 'outbound', protocol: 'any', cidrs: ['0.0.0.0/0'] },
      ],
    });

    const server = await this.servers.create(actor, {
      name,
      size: dto.size ?? 's-1vcpu-2gb',
      // Plain distribution image: our cloud-init is a complete #cloud-config that installs
      // Docker itself. (Marketplace images wrap user-data as a post-install script instead.)
      image: 'ubuntu-24-04',
      project: project.id,
      sshKeys: dto.sshKeys,
      firewalls: [fw.id],
      tags: ['git-deploy'],
      userData: renderDeployCloudInit({ repoUrl: dto.repoUrl, branch: dto.branch ?? 'main', port: dto.port ?? 3000, vmSecret, envVars: dto.env ?? {}, gitToken: dto.gitToken }),
    });

    const d = await this.prisma.deployment.create({
      data: { projectId: project.id, serverId: server.id, name, repoUrl: dto.repoUrl, branch: dto.branch ?? 'main', port: dto.port ?? 3000, webhookSecret, vmSecret, envVars: (dto.env ?? {}) as Prisma.InputJsonValue },
      include: { server: { include: { publicIps: true } } },
    });
    await this.events.emit('deploy.created', { deploymentId: d.id, repoUrl: dto.repoUrl }, { actor, resource: `deployment:${d.id}` });
    // The webhook secret is shown once, with the URL to paste into GitHub → Settings → Webhooks.
    return { ...present(d), webhook: { url: `${process.env.PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/deploys/${d.id}/hook`, secret: webhookSecret, contentType: 'application/json', events: ['push'] } };
  }

  /** Manual redeploy from the console / CLI. */
  async redeploy(actor: Actor, id: string) {
    const d = await this.prisma.deployment.findFirst({ where: { id, project: { teamId: actor.teamId } }, include: { server: { include: { publicIps: true } } } });
    if (!d) throw ApiError.notFound('deployment', id);
    await this.trigger(d);
    await this.events.emit('deploy.triggered', { deploymentId: id, source: 'manual' }, { actor, resource: `deployment:${id}` });
    return { id, status: 'deploying' };
  }

  /** GitHub push webhook (public; authenticated by the HMAC GitHub computes with our secret). */
  async githubHook(id: string, rawBody: Buffer, signature: string | undefined, event: string | undefined) {
    const d = await this.prisma.deployment.findUnique({ where: { id }, include: { server: { include: { publicIps: true } } } });
    if (!d) throw ApiError.notFound('deployment', id);
    const expected = 'sha256=' + createHmac('sha256', d.webhookSecret).update(rawBody).digest('hex');
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw ApiError.unauthorized('Invalid webhook signature');
    }
    if (event === 'ping') return { ok: true, pong: true };
    if (event !== 'push') return { ok: true, ignored: event };
    const payload = JSON.parse(rawBody.toString('utf8')) as { ref?: string; after?: string };
    if (payload.ref && payload.ref !== `refs/heads/${d.branch}`) return { ok: true, ignored: payload.ref };
    await this.trigger(d, payload.after);
    await this.events.emit('deploy.triggered', { deploymentId: id, source: 'github', commit: payload.after }, { teamId: (await this.prisma.project.findUniqueOrThrow({ where: { id: d.projectId } })).teamId, resource: `deployment:${id}` });
    return { ok: true, deploying: true };
  }

  /** Polls the VM's status endpoint and mirrors it into the row. */
  async refreshStatus(id: string) {
    const d = await this.prisma.deployment.findUnique({ where: { id }, include: { server: { include: { publicIps: true } } } });
    if (!d) return;
    const ip = d.server.publicIps[0]?.address;
    if (!ip || d.server.status !== 'active') return;
    try {
      const r = await fetch(`http://${ip}:9009/status`, { signal: AbortSignal.timeout(4000) }).then((r) => r.json() as Promise<{ status: string; commit: string | null }>);
      const status = r.status === 'live' ? 'live' : r.status === 'failed' ? 'failed' : 'deploying';
      await this.prisma.deployment.update({ where: { id }, data: { status, lastCommit: r.commit ?? undefined, ...(status === 'live' ? { lastDeployAt: new Date() } : {}) } });
    } catch {
      /* VM not reachable yet (still booting, or fake driver) — leave status as is */
    }
  }

  private async trigger(d: { id: string; vmSecret: string; server: { status: string; publicIps: { address: string }[] } }, commit?: string) {
    const ip = d.server.publicIps[0]?.address;
    if (!ip || d.server.status !== 'active') throw ApiError.invalidState('Server is not active yet');
    await this.prisma.deployment.update({ where: { id: d.id }, data: { status: 'deploying', lastCommit: commit } });
    try {
      await fetch(`http://${ip}:9009/redeploy`, { method: 'POST', headers: { 'X-Pgcloud-Secret': d.vmSecret }, signal: AbortSignal.timeout(5000) });
    } catch (err) {
      // With the fake driver there is no VM to call; the status poller will keep it 'deploying'.
      this.log.warn(`redeploy hook unreachable for ${d.id}: ${(err as Error).message}`);
    }
  }
}

function present(d: Prisma.DeploymentGetPayload<{ include: { server: { include: { publicIps: true } } } }>) {
  const ip = d.server.publicIps[0]?.address;
  return {
    id: d.id,
    name: d.name,
    repoUrl: d.repoUrl,
    branch: d.branch,
    port: d.port,
    status: d.server.status === 'active' ? d.status : d.server.status === 'failed' ? 'failed' : 'creating',
    url: ip ? `http://${ip}` : null,
    serverId: d.serverId,
    serverStatus: d.server.status,
    lastCommit: d.lastCommit,
    lastDeployAt: d.lastDeployAt,
    createdAt: d.createdAt,
  };
}
