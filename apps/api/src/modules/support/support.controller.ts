import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, Public, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { SupportService } from './support.service';
import { AdminListTicketsQuery, CreateTicketDto, ListTicketsQuery, SetPlanDto, TicketMessageDto } from './support.dto';

@ApiTags('support')
@ApiBearerAuth()
@Controller('v1/support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /** Plan catalog with prices; public so the website can show it. */
  @Public() @Get('plans')
  plans(@Query('currency') currency?: string) {
    return this.support.plans(currency === 'SAR' ? 'SAR' : 'USD');
  }

  @Get('plan') @RequireScopes('support:read')
  current(@CurrentActor() actor: Actor) {
    return this.support.current(actor);
  }

  @Put('plan') @RequireScopes('billing:write')
  setPlan(@CurrentActor() actor: Actor, @Body() dto: SetPlanDto) {
    return this.support.setPlan(actor, dto.plan);
  }

  @Get('tickets') @RequireScopes('support:read')
  list(@CurrentActor() actor: Actor, @Query() q: ListTicketsQuery) {
    return this.support.list(actor, q);
  }

  @Post('tickets') @RequireScopes('support:write') @HttpCode(201)
  create(@CurrentActor() actor: Actor, @Body() dto: CreateTicketDto) {
    return this.support.create(actor, dto);
  }

  @Get('tickets/:id') @RequireScopes('support:read')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.support.get(actor, id);
  }

  @Post('tickets/:id/messages') @RequireScopes('support:write') @HttpCode(201)
  reply(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: TicketMessageDto) {
    return this.support.reply(actor, id, dto);
  }

  @Post('tickets/:id/close') @RequireScopes('support:write') @HttpCode(200)
  close(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.support.close(actor, id);
  }
}

/** Back office: the support queue. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1/support')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets') @RequireScopes('admin')
  list(@Query() q: AdminListTicketsQuery) {
    return this.support.adminList(q);
  }

  @Get('tickets/:id') @RequireScopes('admin')
  get(@Param('id') id: string) {
    return this.support.adminGet(id);
  }

  @Post('tickets/:id/reply') @RequireScopes('admin') @HttpCode(201)
  reply(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: TicketMessageDto & { close?: boolean }) {
    return this.support.adminReply(actor, id, dto, !!dto.close);
  }

  @Post('tickets/:id/close') @RequireScopes('admin') @HttpCode(200)
  close(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.support.adminClose(actor, id);
  }
}
