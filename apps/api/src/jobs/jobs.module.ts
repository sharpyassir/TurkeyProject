import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingModule } from '../modules/billing/billing.module';
import { EventsModule } from '../modules/events/events.module';
import { JobsService } from './jobs.service';

@Module({ imports: [ScheduleModule.forRoot(), BillingModule, EventsModule], providers: [JobsService] })
export class JobsModule {}
