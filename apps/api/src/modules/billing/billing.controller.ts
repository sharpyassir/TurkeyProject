import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CurrentActor, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { ApiError } from '../../common/errors/api-error';
import { IamService } from '../iam/iam.service';
import { InvoicesService } from './invoices.service';
import { SpendService } from './spend.service';
import { displayPrice, startOfMonth } from './pricing';
import { loadConfig } from '../../config/config';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('v1/billing')
@RequireScopes('billing:read')
export class BillingController {
  constructor(private readonly prisma: PrismaService, private readonly invoices: InvoicesService, private readonly spend: SpendService, private readonly iam: IamService) {}

  @Get('balance')
  async balance(@CurrentActor() actor: Actor) {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: actor.teamId }, include: { credits: true, projects: { select: { id: true } } } });
    const credit = team.credits.reduce((s, c) => s + (!c.expiresAt || c.expiresAt > new Date() ? c.remainingMinor : 0), 0);
    const mtd = await this.prisma.usageRecord.aggregate({ where: { projectId: { in: team.projects.map((p) => p.id) }, hourStart: { gte: startOfMonth(new Date()) } }, _sum: { amountMinor: true } });
    return { currency: team.currency, creditMinor: credit, monthToDateMinor: mtd._sum.amountMinor ?? 0, status: team.status };
  }

  @Get('usage')
  async usage(@CurrentActor() actor: Actor, @Query('project') project?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const p = await this.iam.resolveProject(actor, project);
    const rows = await this.prisma.usageRecord.groupBy({
      by: ['resourceType', 'resourceId', 'unit', 'currency'],
      where: { projectId: p.id, hourStart: { gte: from ? new Date(from) : startOfMonth(new Date()), ...(to ? { lt: new Date(to) } : {}) } },
      _sum: { amountMinor: true, quantity: true },
    });
    return { data: rows.map((r) => ({ resourceType: r.resourceType, resourceId: r.resourceId, unit: r.unit, quantity: r._sum.quantity, amountMinor: r._sum.amountMinor, currency: r.currency })) };
  }

  @Get('invoices')
  async list(@CurrentActor() actor: Actor) {
    return { data: await this.invoices.list(actor.teamId) };
  }

  @Get('invoices/:id')
  async get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    const inv = await this.invoices.get(actor.teamId, id);
    if (!inv) throw ApiError.notFound('invoice', id);
    return inv;
  }
}

/** Public price list (no auth) — mirrors what the pricing page shows. */
@ApiTags('pricing')
@Controller('v1/pricing')
export class PricingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async prices(@Query('currency') currency: 'USD' | 'TRY' = loadConfig().DEFAULT_CURRENCY) {
    const prices = await this.prisma.price.findMany({ where: { currency, validTo: null }, include: { size: true } });
    const h = loadConfig().BILLING_HOURS_PER_MONTH;
    return {
      currency,
      hoursPerMonth: h,
      data: prices.map((p) => ({ resourceType: p.resourceType, sku: p.sku, unit: p.unit, ...displayPrice(p.monthlyMinor, h), size: p.size })),
    };
  }
}
