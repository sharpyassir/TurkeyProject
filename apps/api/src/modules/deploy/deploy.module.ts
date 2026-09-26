import { Module, forwardRef } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { ComputeModule } from '../compute/compute.module';
import { EventsModule } from '../events/events.module';
import { NetworkModule } from '../network/network.module';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';

@Module({
  imports: [ComputeModule, NetworkModule, EventsModule, forwardRef(() => GithubModule)],
  controllers: [DeployController],
  providers: [DeployService],
  exports: [DeployService],
})
export class DeployModule {}
