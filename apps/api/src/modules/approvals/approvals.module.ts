import { Global, Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Global()
@Module({
  imports: [EventsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
