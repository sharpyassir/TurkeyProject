import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { KubernetesService } from './k8s.service';
import { CreateClusterDto, NodePoolDto, ScalePoolDto, UpdateClusterDto } from './k8s.dto';

@ApiTags('kubernetes')
@ApiBearerAuth()
@Controller('v1/kubernetes')
export class KubernetesController {
  constructor(private readonly k8s: KubernetesService) {}

  @Get('versions') @RequireScopes('kubernetes:read')
  versions() {
    return this.k8s.versions();
  }

  @Get('clusters') @RequireScopes('kubernetes:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    return this.k8s.list(actor, project);
  }

  @Post('clusters') @RequireScopes('kubernetes:write') @HttpCode(202)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateClusterDto) {
    return this.k8s.create(actor, dto);
  }

  @Get('clusters/:id') @RequireScopes('kubernetes:read')
  get(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.k8s.get(actor, id, project);
  }

  /** The admin kubeconfig as YAML. Treat it like a password. */
  @Get('clusters/:id/kubeconfig') @RequireScopes('kubernetes:write') @Header('Content-Type', 'application/yaml; charset=utf-8')
  kubeconfig(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.k8s.kubeconfig(actor, id, project);
  }

  @Patch('clusters/:id') @RequireScopes('kubernetes:write')
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateClusterDto, @Query('project') project?: string) {
    return this.k8s.update(actor, id, dto, project);
  }

  @Delete('clusters/:id') @RequireScopes('kubernetes:write') @HttpCode(202)
  remove(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.k8s.remove(actor, id, project);
  }

  @Post('clusters/:id/pools') @RequireScopes('kubernetes:write') @HttpCode(202)
  addPool(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: NodePoolDto, @Query('project') project?: string) {
    return this.k8s.addPool(actor, id, dto, project);
  }

  @Patch('clusters/:id/pools/:poolId') @RequireScopes('kubernetes:write') @HttpCode(202)
  scalePool(@CurrentActor() actor: Actor, @Param('id') id: string, @Param('poolId') poolId: string, @Body() dto: ScalePoolDto, @Query('project') project?: string) {
    return this.k8s.scalePool(actor, id, poolId, dto, project);
  }

  @Delete('clusters/:id/pools/:poolId') @RequireScopes('kubernetes:write') @HttpCode(202)
  removePool(@CurrentActor() actor: Actor, @Param('id') id: string, @Param('poolId') poolId: string, @Query('project') project?: string) {
    return this.k8s.removePool(actor, id, poolId, project);
  }
}
