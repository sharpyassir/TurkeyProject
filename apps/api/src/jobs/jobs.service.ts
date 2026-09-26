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
import { ApprovalsService } from '../modules/approvals/approvals.service';
import { MetricsService } from '../modules/monitoring/metrics.service';
import { AlertsService } from '../modules/monitoring/alerts.service';
import { LoadBalancersService } from '../modules/lb/lb.service';
import { DnsService } from '../modules/dns/dns.service';
import { ObjectsService } from '../modules/storage/objects/objects.service';
import { BackupsService } from '../modules/storage/backups.service';

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
    private readonly approvals: ApprovalsService,
    private readonly metrics: MetricsService,
    private readonly alerts: AlertsService,
    private readonly lbs: LoadBalancersService,
    private readonly dns: DnsService,
    private readonly objects: ObjectsService,
    private readonly backups: BackupsService,
  ) {}

  @Cron('0 10 2 * * *') // 02:10 UTC daily: platform backups for servers with backups on
  dailyBackups() {
    return this.locked('daily-backups', 30 * 60_000, () => this.backups.runDaily());
  }

  @Cron('40 */10 * * * *') // every ten minutes: bucket sizes from the storage cluster, for billing
  refreshBucketUsage() {
    return this.locked('bucket-usage', 9 * 60_000, () => this.objects.refreshUsage());
  }

  @Cron('20 * * * * *') // every minute at :20: push DNS zones and PTRs that are behind
  resyncDns() {
    return this.locked('dns-resync', 50_000, () => this.dns.resyncPending());
  }

  @Cron('45 * * * * *') // every minute at :45: load balancer health and config retries
  refreshLoadBalancers() {
    return this.locked('lb-refresh', 50_000, () => this.lbs.refreshAll());
  }

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

  @Cron('7 * * * *') // hourly: refresh the USD→SAR rate
  fxRefresh() {
    return this.locked('fx-refresh', 60_000, () => this.fx.refresh());
  }

  @Cron(CronExpression.EVERY_MINUTE)
  syntheticMetrics() {
    return this.locked('synthetic-metrics', 50_000, () => this.metrics.tickSynthetic());
  }

  @Cron('30 * * * * *') // every minute at :30, after samples for the minute have landed
  evaluateAlerts() {
    return this.locked('evaluate-alerts', 50_000, () => this.alerts.evaluate());
  }

  @Cron('3 * * * *') // three past every hour
  metricsRollup() {
    return this.locked('metrics-rollup', 5 * 60_000, () => this.metrics.rollupAndPrune());
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  expireApprovals() {
    return this.locked('expire-approvals', 60_000, () => this.approvals.expire());
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
