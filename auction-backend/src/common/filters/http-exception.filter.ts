import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception.message;

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ??
      randomUUID();

    const logMessage = `${status} ${request.method} ${request.url} — ${Array.isArray(message) ? message.join('; ') : message}`;
    if (status >= 500) {
      this.logger.error(logMessage, exception.stack);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(status).json({
      success: false,
      error: {
        code: exception.constructor.name.replace('Exception', '').replace(/([A-Z])/g, '_$1').replace(/^_/, '').toUpperCase(),
        message: Array.isArray(message) ? message.join('; ') : message,
        requestId,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
