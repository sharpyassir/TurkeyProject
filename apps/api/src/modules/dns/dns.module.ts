import { Module } from '@nestjs/common';
import { loadConfig } from '../../config/config';
import { EventsModule } from '../events/events.module';
import { DnsController, ReverseDnsController } from './dns.controller';
import { DnsService } from './dns.service';
import { DNS_PROVIDER, FakeDnsProvider, PowerDnsProvider } from './dns.provider';

@Module({
  imports: [EventsModule],
  controllers: [DnsController, ReverseDnsController],
  providers: [
    DnsService,
    {
      provide: DNS_PROVIDER,
      useFactory: () => {
        const cfg = loadConfig();
        if (cfg.DNS_PROVIDER === 'powerdns') {
          if (!cfg.PDNS_API_KEY) throw new Error('PDNS_API_KEY is required when DNS_PROVIDER=powerdns');
          return new PowerDnsProvider(cfg.PDNS_API_URL, cfg.PDNS_API_KEY);
        }
        return new FakeDnsProvider();
      },
    },
  ],
  exports: [DnsService, DNS_PROVIDER],
})
export class DnsModule {}
