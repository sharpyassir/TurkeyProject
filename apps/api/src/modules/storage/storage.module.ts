import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { SnapshotsController } from './snapshots.controller';

@Module({ imports: [EventsModule], controllers: [SnapshotsController] })
export class StorageModule {}
