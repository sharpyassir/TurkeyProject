import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { EventsModule } from '../events/events.module';
import { TrustModule } from '../trust/trust.module';
import { AdminController } from './admin.controller';

@Module({ imports: [EventsModule, TrustModule, BillingModule], controllers: [AdminController] })
export class AdminModule {}
