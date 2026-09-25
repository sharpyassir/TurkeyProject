import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Actor } from './actor';

export const SCOPES_KEY = 'pgcloud:scopes';
export const PUBLIC_KEY = 'pgcloud:public';

/** Scopes required to call this handler. An actor needs every listed scope. */
export const RequireScopes = (...scopes: string[]) => SetMetadata(SCOPES_KEY, scopes);

/** Marks a route as not requiring authentication (signup, login, health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  return ctx.switchToHttp().getRequest().actor;
});
