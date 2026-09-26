import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BillingModule } from '../billing/billing.module';
import { EventsModule } from '../events/events.module';
import { TrustModule } from '../trust/trust.module';
import { AdminController } from './admin.controller';

@Module({ imports: [EventsModule, TrustModule, BillingModule, StorageModule], controllers: [AdminController] })
export class AdminModule {}
