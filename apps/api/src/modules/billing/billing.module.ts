import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BillingController, PricingController } from './billing.controller';
import { InvoicesService } from './invoices.service';
import { MeteringService } from './metering.service';
import { RatingService } from './rating.service';
import { SpendService } from './spend.service';

@Module({
  imports: [EventsModule],
  controllers: [BillingController, PricingController],
  providers: [SpendService, MeteringService, RatingService, InvoicesService],
  exports: [SpendService, MeteringService, RatingService, InvoicesService],
})
export class BillingModule {}
