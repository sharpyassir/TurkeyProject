import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Normalises every error into `{ error: { code, message, details? } }`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('http');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as Record<string, unknown> | string;
      const payload =
        typeof body === 'string'
          ? { code: codeFor(status), message: body }
          : {
              code: (body.code as string) ?? codeFor(status),
              message: Array.isArray(body.message) ? body.message.join('; ') : (body.message as string),
              ...(body.details ? { details: body.details } : {}),
            };
      res.status(status).json({ error: payload });
      return;
    }

    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'internal_error', message: 'Something went wrong on our side' },
    });
  }
}

function codeFor(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return 'invalid_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 429:
      return 'rate_limited';
    default:
      return 'error';
  }
}
