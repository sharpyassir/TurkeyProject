import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../errors/api-error';
import type { Actor } from '../auth/actor';

/**
 * `Idempotency-Key` support for POST/PATCH/DELETE. Replays the stored response for a
 * repeated key + identical body; rejects the same key with a different body.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { actor?: Actor }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.header('Idempotency-Key');
    if (!key || req.method === 'GET' || !req.actor) return next.handle();

    const scopedKey = `${req.actor.teamId}:${req.method}:${req.path}:${key}`;
    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');

    return from(this.prisma.idempotencyKey.findUnique({ where: { key: scopedKey } })).pipe(
      switchMap((stored) => {
        if (stored) {
          if (stored.requestHash !== requestHash) {
            throw ApiError.conflict('idempotency_key_reused', 'Idempotency-Key was already used with a different request body');
          }
          res.status(stored.statusCode);
          res.setHeader('Idempotent-Replayed', 'true');
          return of(stored.response);
        }
        return next.handle().pipe(
          tap((body) => {
            void this.prisma.idempotencyKey
              .create({
                data: { key: scopedKey, teamId: req.actor!.teamId, requestHash, statusCode: res.statusCode, response: body as object },
              })
              .catch(() => undefined); // a race on the same key is harmless
          }),
        );
      }),
    );
  }
}
