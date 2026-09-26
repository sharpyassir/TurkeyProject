import { Module } from '@nestjs/common';
import { ComputeModule } from '../compute/compute.module';
import { NetworkModule } from '../network/network.module';
import { EventsModule } from '../events/events.module';
import { BillingModule } from '../billing/billing.module';
import { CertificatesController, LoadBalancersController } from './lb.controller';
import { LoadBalancersService } from './lb.service';

@Module({
  imports: [ComputeModule, NetworkModule, EventsModule, BillingModule],
  controllers: [LoadBalancersController, CertificatesController],
  providers: [LoadBalancersService],
  exports: [LoadBalancersService],
})
export class LbModule {}
