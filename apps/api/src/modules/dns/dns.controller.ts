import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { DnsService } from './dns.service';
import { CreateDomainDto, CreateRecordDto, ReverseDnsDto, UpdateRecordDto } from './dns.dto';

@ApiTags('dns')
@ApiBearerAuth()
@Controller('v1/domains')
export class DnsController {
  constructor(private readonly dns: DnsService) {}

  @Get() @RequireScopes('dns:read')
  list(@CurrentActor() actor: Actor, @Query('project') project?: string) {
    return this.dns.list(actor, project);
  }

  @Post() @RequireScopes('dns:write') @HttpCode(201)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateDomainDto) {
    return this.dns.create(actor, dto);
  }

  @Get(':name') @RequireScopes('dns:read')
  get(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('project') project?: string) {
    return this.dns.get(actor, name, project);
  }

  @Get(':name/zone-file') @RequireScopes('dns:read') @Header('content-type', 'text/plain; charset=utf-8')
  zoneFile(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('project') project?: string) {
    return this.dns.zoneFile(actor, name, project);
  }

  @Delete(':name') @RequireScopes('dns:write')
  remove(@CurrentActor() actor: Actor, @Param('name') name: string, @Query('project') project?: string) {
    return this.dns.remove(actor, name, project);
  }

  @Post(':name/records') @RequireScopes('dns:write') @HttpCode(201)
  addRecord(@CurrentActor() actor: Actor, @Param('name') name: string, @Body() dto: CreateRecordDto, @Query('project') project?: string) {
    return this.dns.addRecord(actor, name, dto, project);
  }

  @Patch(':name/records/:id') @RequireScopes('dns:write')
  updateRecord(@CurrentActor() actor: Actor, @Param('name') name: string, @Param('id') id: string, @Body() dto: UpdateRecordDto, @Query('project') project?: string) {
    return this.dns.updateRecord(actor, name, id, dto, project);
  }

  @Delete(':name/records/:id') @RequireScopes('dns:write')
  deleteRecord(@CurrentActor() actor: Actor, @Param('name') name: string, @Param('id') id: string, @Query('project') project?: string) {
    return this.dns.deleteRecord(actor, name, id, project);
  }
}

@ApiTags('dns')
@ApiBearerAuth()
@Controller('v1/public-ips')
export class ReverseDnsController {
  constructor(private readonly dns: DnsService) {}

  @Put(':id/reverse-dns') @RequireScopes('network:write')
  set(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: ReverseDnsDto, @Query('project') project?: string) {
    return this.dns.setReverseDns(actor, id, dto, project);
  }
}
