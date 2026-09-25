import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Public API error. Every error the API returns has a stable machine-readable `code`
 * (documented in packages/openapi) plus a human message.
 */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(resource: string, id: string) {
    return new ApiError(HttpStatus.NOT_FOUND, 'not_found', `${resource} ${id} not found`);
  }
  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(HttpStatus.FORBIDDEN, 'forbidden', message);
  }
  static unauthorized(message = 'Invalid or missing credentials') {
    return new ApiError(HttpStatus.UNAUTHORIZED, 'unauthorized', message);
  }
  static invalid(message: string, details?: Record<string, unknown>) {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_request', message, details);
  }
  static conflict(code: string, message: string) {
    return new ApiError(HttpStatus.CONFLICT, code, message);
  }
  static quota(message: string, details?: Record<string, unknown>) {
    return new ApiError(HttpStatus.FORBIDDEN, 'quota_exceeded', message, details);
  }
  static spendLimit(message: string, details?: Record<string, unknown>) {
    return new ApiError(HttpStatus.PAYMENT_REQUIRED, 'spend_limit_reached', message, details);
  }
  static invalidState(message: string) {
    return new ApiError(HttpStatus.CONFLICT, 'invalid_state', message);
  }
}
