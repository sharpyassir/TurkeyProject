import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { NatsModule } from './common/nats/nats.module';
import { RedisModule } from './common/redis/redis.module';
import { DriversModule } from './drivers/drivers.module';
import { EventsModule } from './modules/events/events.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { NetworkModule } from './modules/network/network.module';
import { BillingModule } from './modules/billing/billing.module';
import { IamModule } from './modules/iam/iam.module';
import { MailModule } from './common/mail/mail.module';

/** Dependency graph for the worker process: no HTTP, no controllers. */
@Module({
  imports: [PrismaModule, NatsModule, RedisModule, MailModule, DriversModule, IamModule, EventsModule, SchedulerModule, NetworkModule, BillingModule],
})
export class WorkerModule {}
