import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { SnapshotsController } from './snapshots.controller';
import { VolumesController } from './volumes.controller';
import { VolumesService } from './volumes.service';
import { BillingModule } from '../billing/billing.module';

@Module({ imports: [EventsModule, BillingModule], controllers: [SnapshotsController, VolumesController], providers: [VolumesService], exports: [VolumesService] })
export class StorageModule {}
