import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentActor } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { ApprovalsService } from './approvals.service';

class DenyDto { @IsOptional() @IsString() @MaxLength(500) reason?: string; }

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('v1/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  /** Agents see only their own requests; people see the whole team. */
  @Get()
  async list(@CurrentActor() actor: Actor, @Query('status') status?: string) {
    return { data: await this.approvals.list(actor, status), pending: await this.approvals.pendingCount(actor) };
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.approvals.get(actor, id);
  }

  /** Runs the original request. Owners and admins only, never an agent. */
  @Post(':id/approve')
  approve(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.approvals.approve(actor, id);
  }

  @Post(':id/deny')
  deny(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: DenyDto) {
    return this.approvals.deny(actor, id, dto.reason);
  }
}
