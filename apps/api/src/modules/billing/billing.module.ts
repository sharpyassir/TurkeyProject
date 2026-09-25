import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BillingController, PricingController } from './billing.controller';
import { InvoicesService } from './invoices.service';
import { MeteringService } from './metering.service';
import { RatingService } from './rating.service';
import { SpendService } from './spend.service';
import { FxService } from './fx.service';

@Module({
  imports: [EventsModule],
  controllers: [BillingController, PricingController],
  providers: [FxService, SpendService, MeteringService, RatingService, InvoicesService],
  exports: [FxService, SpendService, MeteringService, RatingService, InvoicesService],
})
export class BillingModule {}
