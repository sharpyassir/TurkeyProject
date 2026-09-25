import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { MeteringService } from '../modules/billing/metering.service';
import { RatingService } from '../modules/billing/rating.service';
import { InvoicesService } from '../modules/billing/invoices.service';
import { SpendService } from '../modules/billing/spend.service';
import { FxService } from '../modules/billing/fx.service';
import { EventsService } from '../modules/events/events.service';

/**
 * Periodic jobs. Each takes a Redis lock so only one API replica runs it.
 * (Moves to Temporal schedules once there is more than one of anything.)
 */
@Injectable()
export class JobsService {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly metering: MeteringService,
    private readonly rating: RatingService,
    private readonly invoices: InvoicesService,
    private readonly spend: SpendService,
    private readonly events: EventsService,
    private readonly fx: FxService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  fallbackMeter() {
    return this.locked('fallback-meter', 50_000, () => this.metering.tickFallback());
  }

  @Cron('5 * * * *') // five past every hour
  rateHour() {
    return this.locked('rate-hour', 10 * 60_000, () => this.rating.rollupPreviousHour());
  }

  @Cron('30 0 1 * *') // 00:30 UTC on the 1st
  monthly() {
    return this.locked('monthly', 30 * 60_000, async () => {
      await this.invoices.issueForPreviousMonth();
      await this.spend.resetTokenCounters();
    });
  }

  @Cron('7 * * * *') // hourly: refresh the USD→TRY rate
  fxRefresh() {
    return this.locked('fx-refresh', 60_000, () => this.fx.refresh());
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  webhooks() {
    return this.locked('webhooks', 9_000, () => this.events.deliverPending());
  }

  @Cron(CronExpression.EVERY_HOUR)
  cleanupIdempotencyKeys() {
    return this.locked('idem-cleanup', 60_000, () =>
      this.prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } }),
    );
  }

  private async locked(name: string, ttlMs: number, fn: () => Promise<unknown>) {
    const release = await this.redis.lock(`job:${name}`, ttlMs);
    if (!release) return;
    try {
      await fn();
    } catch (err) {
      this.log.error(`job ${name} failed: ${(err as Error).message}`);
    } finally {
      await release();
    }
  }
}
