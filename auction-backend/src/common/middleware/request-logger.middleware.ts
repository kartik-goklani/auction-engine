import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../logger/logger.service';

const CONTEXT = 'HTTP';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const msg = `${method} ${originalUrl} ${statusCode} ${duration}ms`;

      if (statusCode >= 500) {
        this.logger.error(msg, undefined, CONTEXT);
      } else if (statusCode >= 400) {
        this.logger.warn(msg, CONTEXT);
      } else {
        this.logger.log(msg, CONTEXT);
      }
    });

    next();
  }
}
