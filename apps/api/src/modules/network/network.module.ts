import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { FirewallsService } from './firewalls.service';
import { IpsService } from './ips.service';
import { NetworkController } from './network.controller';

@Module({
  imports: [EventsModule],
  controllers: [NetworkController],
  providers: [FirewallsService, IpsService],
  exports: [FirewallsService, IpsService],
})
export class NetworkModule {}
