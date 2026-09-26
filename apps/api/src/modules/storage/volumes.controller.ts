import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { VolumesService } from './volumes.service';
import { AttachVolumeDto, CreateVolumeDto, ResizeVolumeDto } from './volumes.dto';

@ApiTags('volumes')
@ApiBearerAuth()
@Controller('v1/volumes')
export class VolumesController {
  constructor(private readonly volumes: VolumesService) {}

  @Get() @RequireScopes('volumes:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string, @Query('server') server?: string) {
    return this.volumes.list(actor, project, server);
  }

  @Post() @RequireScopes('volumes:write') @HttpCode(202)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateVolumeDto) {
    return this.volumes.create(actor, dto);
  }

  @Get(':id') @RequireScopes('volumes:read')
  get(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.volumes.get(actor, id, project);
  }

  @Post(':id/attach') @RequireScopes('volumes:write') @HttpCode(202)
  attach(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: AttachVolumeDto, @Query('project') project?: string) {
    return this.volumes.attach(actor, id, dto, project);
  }

  @Post(':id/detach') @RequireScopes('volumes:write') @HttpCode(202)
  detach(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.volumes.detach(actor, id, project);
  }

  @Post(':id/resize') @RequireScopes('volumes:write') @HttpCode(202)
  resize(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: ResizeVolumeDto, @Query('project') project?: string) {
    return this.volumes.resize(actor, id, dto, project);
  }

  @Delete(':id') @RequireScopes('volumes:write') @HttpCode(202)
  remove(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.volumes.remove(actor, id, project);
  }
}
