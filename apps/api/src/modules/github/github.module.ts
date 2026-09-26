import { Module, forwardRef } from '@nestjs/common';
import { DeployModule } from '../deploy/deploy.module';
import { AppPlatformModule } from '../app-platform/app.module';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [forwardRef(() => DeployModule), forwardRef(() => AppPlatformModule)],
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
