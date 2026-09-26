import { Controller, Delete, Get, HttpCode, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TemporalService } from '../../common/temporal/temporal.service';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { ApiError } from '../../common/errors/api-error';
import { IamService } from '../iam/iam.service';
import { EventsService } from '../events/events.service';

/**
 * Snapshots are created through `POST /servers/:id/actions {type:"snapshot"}`; this
 * controller lists and deletes them. Daily backups are taken by BackupsService.
 */
@ApiTags('snapshots')
@ApiBearerAuth()
@Controller('v1/snapshots')
export class SnapshotsController {
  constructor(private readonly prisma: PrismaService, private readonly iam: IamService, private readonly temporal: TemporalService, private readonly events: EventsService) {}

  @Get() @RequireScopes('snapshots:read')
  async list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    const p = await this.iam.resolveProject(actor, project);
    const data = await this.prisma.snapshot.findMany({
      where: { projectId: p.id, deletedAt: null },
      select: { id: true, name: true, kind: true, status: true, sizeGb: true, serverId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  @Delete(':id') @RequireScopes('snapshots:write') @HttpCode(202)
  async remove(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    const p = await this.iam.resolveProject(actor, project);
    const snap = await this.prisma.snapshot.findFirst({ where: { id, projectId: p.id, deletedAt: null } });
    if (!snap) throw ApiError.notFound('snapshot', id);
    if (snap.status === 'pending') throw ApiError.invalidState('Snapshot is still being created');
    await this.temporal.start('deleteSnapshot', [{ snapshotId: id }], `deleteSnapshot-${id}`);
    await this.events.emit('snapshot.delete_requested', { snapshotId: id }, { actor, resource: `snapshot:${id}` });
    return { id, status: 'deleting' };
  }
}
