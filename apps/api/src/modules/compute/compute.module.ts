import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { TrustModule } from '../trust/trust.module';
import { BillingModule } from '../billing/billing.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { CatalogController, ManagedCareController, ServersController } from './compute.controller';
import { ManagedCareService, ServersService } from './servers.service';

@Module({
  imports: [EventsModule, TrustModule, BillingModule, MarketplaceModule],
  controllers: [ServersController, CatalogController, ManagedCareController],
  providers: [ServersService, ManagedCareService],
  exports: [ServersService],
})
export class ComputeModule {}
