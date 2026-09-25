import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { NatsModule } from './common/nats/nats.module';
import { RedisModule } from './common/redis/redis.module';
import { TemporalModule } from './common/temporal/temporal.module';
import { DriversModule } from './drivers/drivers.module';
import { AuthGuard } from './common/auth/auth.guard';
import { RateLimitGuard } from './common/auth/rate-limit.guard';
import { MailModule } from './common/mail/mail.module';
import { ApiExceptionFilter } from './common/errors/http-exception.filter';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { IamModule } from './modules/iam/iam.module';
import { EventsModule } from './modules/events/events.module';
import { ComputeModule } from './modules/compute/compute.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { NetworkModule } from './modules/network/network.module';
import { StorageModule } from './modules/storage/storage.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { BillingModule } from './modules/billing/billing.module';
import { TrustModule } from './modules/trust/trust.module';
import { AdminModule } from './modules/admin/admin.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthController } from './health.controller';

/** The modular monolith. One module per bounded context (docs/adr/0001). */
@Module({
  imports: [
    // infrastructure
    PrismaModule, NatsModule, RedisModule, TemporalModule, DriversModule, MailModule,
    // domain
    IamModule, EventsModule, ComputeModule, SchedulerModule, NetworkModule, StorageModule, MarketplaceModule, BillingModule, TrustModule, AdminModule, DeployModule,
    // background
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard }, // after AuthGuard so limits can key by token
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
