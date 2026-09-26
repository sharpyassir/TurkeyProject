import { Module, forwardRef } from '@nestjs/common';
import { DeployModule } from '../deploy/deploy.module';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [forwardRef(() => DeployModule)],
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
