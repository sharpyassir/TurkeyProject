import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { LoadBalancersService } from './lb.service';
import { CreateCertificateDto, CreateLoadBalancerDto, TargetsDto, UpdateLoadBalancerDto } from './lb.dto';

@ApiTags('load-balancers')
@ApiBearerAuth()
@Controller('v1/load-balancers')
export class LoadBalancersController {
  constructor(private readonly lbs: LoadBalancersService) {}

  @Get() @RequireScopes('network:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    return this.lbs.list(actor, project);
  }

  @Post() @RequireScopes('network:write') @HttpCode(202)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateLoadBalancerDto) {
    return this.lbs.create(actor, dto);
  }

  @Get(':id') @RequireScopes('network:read')
  get(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.lbs.get(actor, id, project);
  }

  @Patch(':id') @RequireScopes('network:write') @HttpCode(202)
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateLoadBalancerDto, @Query('project') project?: string) {
    return this.lbs.update(actor, id, dto, project);
  }

  @Post(':id/servers') @RequireScopes('network:write') @HttpCode(202)
  addTargets(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: TargetsDto, @Query('project') project?: string) {
    return this.lbs.addTargets(actor, id, dto, project);
  }

  @Delete(':id/servers/:serverId') @RequireScopes('network:write') @HttpCode(202)
  removeTarget(@CurrentActor() actor: Actor, @Param('id') id: string, @Param('serverId') serverId: string, @Query('project') project?: string) {
    return this.lbs.removeTarget(actor, id, serverId, project);
  }

  @Delete(':id') @RequireScopes('network:write') @HttpCode(202)
  remove(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.lbs.remove(actor, id, project);
  }
}

@ApiTags('load-balancers')
@ApiBearerAuth()
@Controller('v1/certificates')
export class CertificatesController {
  constructor(private readonly lbs: LoadBalancersService) {}

  @Get() @RequireScopes('network:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    return this.lbs.listCertificates(actor, project);
  }

  @Post() @RequireScopes('network:write') @HttpCode(201)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateCertificateDto) {
    return this.lbs.createCertificate(actor, dto);
  }

  @Delete(':id') @RequireScopes('network:write')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string, @Query('project') project?: string) {
    return this.lbs.deleteCertificate(actor, id, project);
  }
}
