import { Injectable } from '@nestjs/common';
import type { LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { type Logger } from 'pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly pino: Logger;

  constructor(config: ConfigService) {
    const isDev = config.get<string>('NODE_ENV') !== 'production';
    this.pino = pino({
      level: isDev ? 'debug' : 'info',
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          }
        : undefined,
      base: { service: 'auction-backend' },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    const context = this.extractContext(optionalParams);
    this.pino.info({ context }, String(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    // NestJS passes (message, trace?, context?) — trace is the stack string
    const [trace, context] = optionalParams as [string?, string?];
    this.pino.error({ context, trace }, String(message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    const context = this.extractContext(optionalParams);
    this.pino.warn({ context }, String(message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    const context = this.extractContext(optionalParams);
    this.pino.debug({ context }, String(message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    const context = this.extractContext(optionalParams);
    this.pino.trace({ context }, String(message));
  }

  /** Expose a child logger pre-bound with structured fields (e.g. auctionId, agentRunId). */
  child(bindings: Record<string, unknown>): Logger {
    return this.pino.child(bindings);
  }

  private extractContext(params: unknown[]): string | undefined {
    if (params.length === 0) return undefined;
    const last = params[params.length - 1];
    return typeof last === 'string' ? last : undefined;
  }
}
