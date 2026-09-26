import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { MonitoringController } from './monitoring.controller';
import { MetricsService } from './metrics.service';
import { AlertsService } from './alerts.service';

@Module({
  imports: [EventsModule],
  controllers: [MonitoringController],
  providers: [MetricsService, AlertsService],
  exports: [MetricsService, AlertsService],
})
export class MonitoringModule {}
