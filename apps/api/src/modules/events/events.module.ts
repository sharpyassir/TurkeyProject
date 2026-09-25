import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [WebhooksController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
