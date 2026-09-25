import { Global, Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AccountController, AuthController } from './iam.controller';
import { IamService } from './iam.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [EventsModule],
  controllers: [AuthController, AccountController],
  providers: [IamService, TokenService],
  exports: [IamService, TokenService],
})
export class IamModule {}
