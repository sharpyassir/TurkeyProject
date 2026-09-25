import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { TrustService } from '../trust/trust.service';
import { EventsService } from '../events/events.service';
import { RatingService } from '../billing/rating.service';
import { InvoicesService } from '../billing/invoices.service';
import { FxService } from '../billing/fx.service';

class RegisterHostDto {
  @IsString() name: string;
  @IsString() regionId: string;
  @IsOptional() @IsString() driver?: 'proxmox' | 'fake';
  @IsString() driverRef: string; // {"hostId":"…","node":"pve1"} — hostId is filled in by us
  @IsInt() @Min(1) totalVcpu: number;
  @IsInt() @Min(1) totalMemoryMb: number;
  @IsInt() @Min(1) totalDiskGb: number;
}

class HostStatusDto {
  @IsIn(['active', 'draining', 'maintenance', 'down']) status: 'active' | 'draining' | 'maintenance' | 'down';
}

class CreditDto {
  @IsIn(['promo', 'prepaid', 'refund', 'goodwill']) kind: 'promo' | 'prepaid' | 'refund' | 'goodwill';
  @IsInt() @Min(1) amountMinor: number;
  @IsOptional() @IsString() reason?: string;
}

class SuspendDto {
  @IsString() reason: string;
}

/**
 * Back-office API for support, capacity and finance. Requires the `admin` scope, which
 * only staff tokens carry (issued out-of-band; never via /v1/tokens).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/v1')
@RequireScopes('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trust: TrustService,
    private readonly events: EventsService,
    private readonly rating: RatingService,
    private readonly invoices: InvoicesService,
    private readonly fx: FxService,
  ) {}

  // ---- capacity ----

  @Get('hosts')
  async hosts() {
    return { data: await this.prisma.host.findMany({ include: { _count: { select: { servers: true } } }, orderBy: { name: 'asc' } }) };
  }

  @Post('hosts')
  async registerHost(@CurrentActor() actor: Actor, @Body() dto: RegisterHostDto) {
    const host = await this.prisma.host.create({ data: { ...dto, driver: dto.driver ?? 'proxmox', driverRef: '{}' } });
    const ref = { ...JSON.parse(dto.driverRef), hostId: host.id };
    const updated = await this.prisma.host.update({ where: { id: host.id }, data: { driverRef: JSON.stringify(ref) } });
    await this.events.emit('admin.host_registered', { hostId: host.id, name: host.name }, { actor });
    return updated;
  }

  @Post('hosts/:id/status') @HttpCode(204)
  async hostStatus(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: HostStatusDto) {
    await this.prisma.host.update({ where: { id }, data: { status: dto.status } });
    await this.events.emit('admin.host_status', { hostId: id, status: dto.status }, { actor });
  }

  // ---- support ----

  @Get('teams')
  async teams(@Query('q') q?: string) {
    return {
      data: await this.prisma.team.findMany({
        where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q } }, { members: { some: { user: { email: { contains: q, mode: 'insensitive' } } } } }] } : {},
        include: { _count: { select: { projects: true, abuseFlags: true } } },
        take: 50,
      }),
    };
  }

  @Get('teams/:id')
  team(@Param('id') id: string) {
    return this.prisma.team.findUniqueOrThrow({
      where: { id },
      include: { members: { include: { user: { select: { id: true, email: true, name: true } } } }, projects: { include: { _count: { select: { servers: true } } } }, abuseFlags: { where: { resolvedAt: null } }, credits: true, invoices: { take: 12, orderBy: { periodStart: 'desc' } } },
    });
  }

  @Post('teams/:id/suspend') @HttpCode(204)
  async suspend(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: SuspendDto) {
    await this.trust.suspend(id, `manual: ${dto.reason}`);
    await this.events.emit('admin.team_suspended', { teamId: id, reason: dto.reason }, { actor });
  }

  @Post('teams/:id/reinstate') @HttpCode(204)
  async reinstate(@CurrentActor() actor: Actor, @Param('id') id: string) {
    await this.trust.reinstate(id);
    await this.events.emit('admin.team_reinstated', { teamId: id }, { actor });
  }

  @Post('teams/:id/verify') @HttpCode(204)
  async verify(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: { kycLevel: number }) {
    await this.prisma.team.update({ where: { id }, data: { kycLevel: body.kycLevel, status: body.kycLevel >= 1 ? 'active' : undefined } });
    await this.events.emit('admin.team_verified', { teamId: id, kycLevel: body.kycLevel }, { actor });
  }

  // ---- finance ----

  @Post('teams/:id/credits')
  async credit(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: CreditDto) {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id } });
    const credit = await this.prisma.credit.create({ data: { teamId: id, kind: dto.kind, currency: team.currency, amountMinor: dto.amountMinor, remainingMinor: dto.amountMinor, reason: dto.reason } });
    await this.events.emit('admin.credit_added', { teamId: id, creditId: credit.id, amountMinor: dto.amountMinor }, { actor });
    return credit;
  }

  @Post('billing/rollup')
  async rollup(@Body() body: { hourStart?: string }) {
    const n = body.hourStart ? await this.rating.rollupHour(new Date(body.hourStart)) : await this.rating.rollupPreviousHour();
    return { rated: n };
  }

  @Post('billing/issue-invoices')
  async issue() {
    return { issued: await this.invoices.issueForPreviousMonth() };
  }

  // ---- exchange rate ----

  @Get('fx')
  async fx_() {
    return { base: 'USD', quote: 'TRY', rate: await this.fx.rate('TRY'), history: await this.prisma.fxRate.findMany({ orderBy: { at: 'desc' }, take: 20 }) };
  }

  /** Set the USD→TRY rate by hand (e.g. from the TCMB daily rate). */
  @Post('fx')
  async setFx(@CurrentActor() actor: Actor, @Body() body: { rate: number }) {
    if (!(body.rate > 0)) throw new Error('rate must be positive');
    const row = await this.fx.set('TRY', body.rate, `admin:${actor.userId}`);
    await this.events.emit('admin.fx_set', { rate: body.rate }, { actor });
    return row;
  }

  @Post('fx/refresh')
  async refreshFx() {
    return { rate: await this.fx.refresh() };
  }

  @Get('abuse')
  async abuse() {
    return { data: await this.prisma.abuseFlag.findMany({ where: { resolvedAt: null }, include: { team: { select: { id: true, name: true, slug: true } } }, orderBy: { score: 'desc' }, take: 100 }) };
  }
}
