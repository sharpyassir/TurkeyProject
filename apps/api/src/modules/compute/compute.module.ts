import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { TrustModule } from '../trust/trust.module';
import { BillingModule } from '../billing/billing.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { CatalogController, ServersController } from './compute.controller';
import { ServersService } from './servers.service';

@Module({
  imports: [EventsModule, TrustModule, BillingModule, MarketplaceModule],
  controllers: [ServersController, CatalogController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ComputeModule {}
