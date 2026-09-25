import { Global, Module } from '@nestjs/common';
import { loadConfig } from '../config/config';
import { NatsService } from '../common/nats/nats.service';
import { FakeDriver } from './fake.driver';
import { HYPERVISOR_DRIVER } from './hypervisor.driver';
import { ProxmoxDriver } from './proxmox.driver';

@Global()
@Module({
  providers: [
    FakeDriver,
    ProxmoxDriver,
    {
      provide: HYPERVISOR_DRIVER,
      inject: [FakeDriver, NatsService],
      useFactory: (fake: FakeDriver, nats: NatsService) =>
        loadConfig().HYPERVISOR_DRIVER === 'proxmox' ? new ProxmoxDriver(nats) : fake,
    },
  ],
  exports: [HYPERVISOR_DRIVER],
})
export class DriversModule {}
