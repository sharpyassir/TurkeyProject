import { Injectable, Logger } from '@nestjs/common';
import { Currency, ResourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { loadConfig } from '../../config/config';
import { rateHour, startOfHour, startOfMonth } from './pricing';

/**
 * Hourly roll-up: UsageEvent (per minute) → UsageRecord (per resource per hour, rated).
 * Idempotent: re-running for an hour upserts the same rows.
 */
@Injectable()
export class RatingService {
  private readonly log = new Logger(RatingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Rates the hour that ended most recently (called a few minutes past every hour). */
  async rollupPreviousHour(now = new Date()) {
    const hourStart = new Date(startOfHour(now).getTime() - 3_600_000);
    return this.rollupHour(hourStart);
  }

  async rollupHour(hourStart: Date) {
    const hourEnd = new Date(hourStart.getTime() + 3_600_000);
    const groups = await this.prisma.usageEvent.groupBy({
      by: ['projectId', 'resourceType', 'resourceId', 'unit'],
      where: { at: { gte: hourStart, lt: hourEnd } },
      _sum: { quantity: true },
      _count: { _all: true },
    });
    if (!groups.length) return 0;

    const projectIds = [...new Set(groups.map((g) => g.projectId))];
    const projects = await this.prisma.project.findMany({ where: { id: { in: projectIds } }, include: { team: { select: { currency: true } } } });
    const currencyOf = new Map(projects.map((p) => [p.id, p.team.currency]));

    const hoursPerMonth = loadConfig().BILLING_HOURS_PER_MONTH;
    let written = 0;

    for (const g of groups) {
      const currency = currencyOf.get(g.projectId) ?? 'USD';
      const sku = await this.skuFor(g.resourceType, g.resourceId);
      const price = sku ? await this.priceFor(g.resourceType, sku, currency, hourEnd) : null;

      const minutes = g.unit === 'minute' ? g._count._all : g._count._all; // one event per minute either way
      const quantity = g._sum.quantity ?? 0;

      // Per-GB resources are priced per GB-month; scale monthly price by average GB in the hour.
      const monthlyMinor = price ? (g.unit === 'gb_minute' ? Math.round(price.monthlyMinor * (quantity / Math.max(minutes, 1))) : price.monthlyMinor) : 0;

      const charged = await this.prisma.usageRecord.aggregate({
        where: { resourceType: g.resourceType, resourceId: g.resourceId, hourStart: { gte: startOfMonth(hourStart), lt: hourStart } },
        _sum: { amountMinor: true },
      });

      const amountMinor = rateHour({ minutes, monthlyMinor, hoursPerMonth, chargedThisMonthMinor: charged._sum.amountMinor ?? 0 });

      await this.prisma.usageRecord.upsert({
        where: { resourceType_resourceId_hourStart: { resourceType: g.resourceType, resourceId: g.resourceId, hourStart } },
        create: { projectId: g.projectId, resourceType: g.resourceType, resourceId: g.resourceId, hourStart, quantity, unit: g.unit, priceId: price?.id, amountMinor, currency },
        update: { quantity, priceId: price?.id, amountMinor },
      });
      written++;
    }
    this.log.log(`rated ${written} resources for hour ${hourStart.toISOString()}`);
    return written;
  }

  private async skuFor(type: ResourceType, resourceId: string): Promise<string | null> {
    switch (type) {
      case 'server': {
        const s = await this.prisma.server.findUnique({ where: { id: resourceId }, select: { sizeId: true } });
        return s?.sizeId ?? null;
      }
      case 'public_ip':
        return 'public_ip';
      case 'snapshot':
        return 'snapshot_gb';
      case 'bandwidth':
        return 'bandwidth_gb';
      default:
        return null;
    }
  }

  /** Newest price that was valid at any point before the hour ended, so a price book change mid-hour still rates that hour. */
  private priceFor(resourceType: ResourceType, sku: string, currency: Currency, hourEnd: Date) {
    return this.prisma.price.findFirst({
      where: { resourceType, sku, currency, validFrom: { lt: hourEnd }, OR: [{ validTo: null }, { validTo: { gte: hourEnd } }] },
      orderBy: { validFrom: 'desc' },
    });
  }
}
