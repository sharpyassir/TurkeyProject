import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TemporalService } from '../../common/temporal/temporal.service';
import { EventsService } from '../events/events.service';

const KEEP = 7;
const MIN_GAP_MS = 20 * 60 * 60_000;

/**
 * Daily backups. Once a day every server with backups on gets a platform taken snapshot
 * (kind = backup, named by date), and the oldest beyond the last seven are deleted. Backup
 * snapshots are covered by the backups add on, so metering skips them. Idempotent: a run can
 * repeat within the day without taking a second snapshot.
 */
@Injectable()
export class BackupsService {
  private readonly log = new Logger(BackupsService.name);

  constructor(private readonly prisma: PrismaService, private readonly temporal: TemporalService, private readonly events: EventsService) {}

  async runDaily(now = new Date()) {
    const servers = await this.prisma.server.findMany({
      where: { backupsEnabled: true, deletedAt: null, managedBy: null, status: { in: ['active', 'off'] } },
      select: { id: true, name: true, projectId: true, project: { select: { teamId: true } }, snapshots: { where: { kind: 'backup', status: { in: ['pending', 'available'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true } } },
    });
    let taken = 0, pruned = 0;
    for (const s of servers) {
      const latest = s.snapshots[0];
      const due = !latest || now.getTime() - latest.createdAt.getTime() >= MIN_GAP_MS;
      const inFlight = s.snapshots.some((x) => x.status === 'pending');
      if (due && !inFlight) {
        const name = `backup-${s.name}-${now.toISOString().slice(0, 10)}`;
        const action = await this.prisma.serverAction.create({ data: { serverId: s.id, type: 'snapshot', params: { name, kind: 'backup' }, requestedBy: 'system:backups' } });
        try {
          await this.temporal.start('snapshotServer', [{ serverId: s.id, actionId: action.id, name, kind: 'backup' }], `snapshotServer-${action.id}`);
          await this.prisma.serverAction.update({ where: { id: action.id }, data: { workflowId: `snapshotServer-${action.id}`, status: 'running' } });
          taken++;
        } catch (err) {
          await this.prisma.serverAction.update({ where: { id: action.id }, data: { status: 'failed', error: 'workflow_start_failed', finishedAt: new Date() } });
          this.log.warn(`backup for ${s.name} could not start: ${(err as Error).message}`);
        }
      }
      // Keep the newest seven available backups; older ones go.
      const available = s.snapshots.filter((x) => x.status === 'available');
      for (const old of available.slice(KEEP)) {
        await this.temporal.start('deleteSnapshot', [{ snapshotId: old.id }], `deleteSnapshot-${old.id}`).catch(() => undefined);
        pruned++;
      }
    }
    if (taken || pruned) this.log.log(`backups: ${taken} taken, ${pruned} pruned across ${servers.length} servers`);
    return { servers: servers.length, taken, pruned };
  }
}
