import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { TrustService } from './trust.service';

@Module({ imports: [EventsModule], providers: [TrustService], exports: [TrustService] })
export class TrustModule {}
