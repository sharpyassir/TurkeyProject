import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor, Public, RequireScopes } from '../../common/auth/decorators';
import type { Actor } from '../../common/auth/actor';
import { IamService } from './iam.service';
import { CreateProjectDto, CreateSshKeyDto, CreateTokenDto, LoginDto, SignupDto } from './iam.dto';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly iam: IamService) {}

  @Public() @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.iam.signup(dto);
  }

  @Public() @Post('login') @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.iam.login(dto);
  }
}

@ApiTags('account')
@ApiBearerAuth()
@Controller('v1')
export class AccountController {
  constructor(private readonly iam: IamService) {}

  @Get('account')
  me(@CurrentActor() actor: Actor) {
    return this.iam.me(actor);
  }

  @Get('projects')
  async projects(@CurrentActor() actor: Actor) {
    return { data: await this.iam.listProjects(actor) };
  }

  @Post('projects') @RequireScopes('iam:write')
  createProject(@CurrentActor() actor: Actor, @Body() dto: CreateProjectDto) {
    return this.iam.createProject(actor, dto);
  }

  @Get('tokens') @RequireScopes('iam:read')
  async tokens(@CurrentActor() actor: Actor) {
    return { data: await this.iam.listTokens(actor) };
  }

  @Post('tokens') @RequireScopes('iam:write')
  createToken(@CurrentActor() actor: Actor, @Body() dto: CreateTokenDto) {
    return this.iam.createToken(actor, dto);
  }

  @Delete('tokens/:id') @RequireScopes('iam:write') @HttpCode(204)
  revokeToken(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.iam.revokeToken(actor, id);
  }

  @Get('ssh-keys')
  async sshKeys(@CurrentActor() actor: Actor) {
    return { data: await this.iam.listSshKeys(actor) };
  }

  @Post('ssh-keys')
  createSshKey(@CurrentActor() actor: Actor, @Body() dto: CreateSshKeyDto) {
    return this.iam.createSshKey(actor, dto);
  }

  @Delete('ssh-keys/:id') @HttpCode(204)
  deleteSshKey(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.iam.deleteSshKey(actor, id);
  }
}
