import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { BillingModule } from '../billing/billing.module';
import { NetworkModule } from '../network/network.module';
import { GithubModule } from '../github/github.module';
import { AdminAppPlatformController, AppPlatformController } from './app.controller';
import { AppPlatformService } from './app.service';

@Module({
  imports: [EventsModule, BillingModule, NetworkModule, forwardRef(() => GithubModule)],
  controllers: [AppPlatformController, AdminAppPlatformController],
  providers: [AppPlatformService],
  exports: [AppPlatformService],
})
export class AppPlatformModule {}
