import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { CurrentActor, Public } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { AccountSecurityService } from './account-security.service';

class TokenDto { @IsString() @Length(20, 200) token: string; }
class ForgotDto { @IsEmail() email: string; }
class ResetDto { @IsString() @Length(20, 200) token: string; @IsString() @MinLength(10) password: string; }
class CodeDto { @IsString() @Length(6, 12) code: string; }

@ApiTags('auth')
@Controller('v1/auth')
export class AccountSecurityController {
  constructor(private readonly security: AccountSecurityService) {}

  /** Re-send the verification email for the signed in user. */
  @ApiBearerAuth() @Post('verify/request') @HttpCode(204)
  async requestVerification(@CurrentActor() actor: Actor) {
    await this.security.sendVerification(actor.userId);
  }

  @Public() @Post('verify') @HttpCode(200)
  verify(@Body() dto: TokenDto) {
    return this.security.verifyEmail(dto.token);
  }

  /** Always 204 so email addresses cannot be probed. */
  @Public() @Post('password/forgot') @HttpCode(204)
  async forgot(@Body() dto: ForgotDto) {
    await this.security.forgotPassword(dto.email);
  }

  @Public() @Post('password/reset') @HttpCode(200)
  reset(@Body() dto: ResetDto) {
    return this.security.resetPassword(dto.token, dto.password);
  }

  @ApiBearerAuth() @Post('totp/setup')
  totpSetup(@CurrentActor() actor: Actor) {
    return this.security.totpSetup(actor);
  }

  @ApiBearerAuth() @Post('totp/enable')
  totpEnable(@CurrentActor() actor: Actor, @Body() dto: CodeDto) {
    return this.security.totpEnable(actor, dto.code);
  }

  @ApiBearerAuth() @Post('totp/disable')
  totpDisable(@CurrentActor() actor: Actor, @Body() dto: CodeDto) {
    return this.security.totpDisable(actor, dto.code);
  }
}
