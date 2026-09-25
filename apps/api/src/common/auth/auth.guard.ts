import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiError } from '../errors/api-error';
import { TokenService } from '../../modules/iam/token.service';
import { PUBLIC_KEY, SCOPES_KEY } from './decorators';
import type { Actor } from './actor';

/**
 * Resolves `Authorization: Bearer …` into an Actor and enforces `@RequireScopes`.
 * Accepts API tokens (`pgc_…`) and console session JWTs.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const header = req.headers.authorization ?? '';
    const [scheme, credential] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !credential) throw ApiError.unauthorized();

    const actor = await this.tokens.resolveBearer(credential);
    if (!actor) throw ApiError.unauthorized();
    req.actor = actor;

    const required = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const missing = required.filter((s) => !actor.scopes.has(s));
    if (missing.length) {
      throw ApiError.forbidden(`Token is missing required scope(s): ${missing.join(', ')}`);
    }
    return true;
  }
}
