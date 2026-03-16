import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REALTIME } from '../common/constants';

/**
 * Configures Socket.IO with explicit ping timings and CORS derived from
 * FRONTEND_URLS — replacing the insecure `origin: '*'` on the gateway decorator.
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: Record<string, unknown>) {
    const rawUrls = this.config.get<string>('FRONTEND_URLS') ?? '';
    const origin = rawUrls
      ? rawUrls.split(',').map((u) => u.trim())
      : '*'; // fallback for local dev without FRONTEND_URLS set

    return super.createIOServer(port, {
      ...options,
      pingInterval: REALTIME.PING_INTERVAL_MS,
      pingTimeout: REALTIME.PING_TIMEOUT_MS,
      cors: { origin, credentials: true },
    });
  }
}
