import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentActor, Public, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { ServersService } from './servers.service';
import { CreateServerDto, ListServersQuery, ServerActionDto, UpdateServerDto } from './compute.dto';

@ApiTags('servers')
@ApiBearerAuth()
@Controller('v1/servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Get() @RequireScopes('servers:read')
  list(@CurrentActor() actor: Actor, @Query() q: ListServersQuery) {
    return this.servers.list(actor, q);
  }

  /** Returns 202: the server is `new` and a workflow is provisioning it. */
  @Post() @RequireScopes('servers:write') @HttpCode(202)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateServerDto) {
    return this.servers.create(actor, dto);
  }

  @Get(':id') @RequireScopes('servers:read')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.servers.get(actor, id);
  }

  @Patch(':id') @RequireScopes('servers:write')
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateServerDto) {
    return this.servers.update(actor, id, dto);
  }

  @Post(':id/actions') @RequireScopes('servers:write') @HttpCode(202)
  action(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: ServerActionDto) {
    return this.servers.action(actor, id, dto);
  }

  @Get(':id/actions') @RequireScopes('servers:read')
  async actions(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return { data: await this.servers.actions(actor, id) };
  }

  @Delete(':id') @RequireScopes('servers:delete') @HttpCode(202)
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.servers.delete(actor, id);
  }
}

@ApiTags('catalog')
@Controller('v1')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Public() @Get('regions')
  async regions() {
    return { data: await this.prisma.region.findMany({ where: { available: true } }) };
  }

  @Public() @Get('sizes')
  async sizes() {
    return { data: await this.prisma.size.findMany({ where: { available: true }, orderBy: { sortOrder: 'asc' } }) };
  }

  @Public() @Get('images')
  async images(@Query('kind') kind?: 'distribution' | 'marketplace') {
    return {
      data: await this.prisma.image.findMany({
        where: { public: true, deprecated: false, ...(kind ? { kind } : {}) },
        select: { id: true, kind: true, name: true, distribution: true, version: true, minDiskGb: true, minMemoryMb: true, regionId: true },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      }),
    };
  }
}
