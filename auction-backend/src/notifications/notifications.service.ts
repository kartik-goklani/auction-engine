import { Injectable } from '@nestjs/common';
import { NotificationsRepository, type NotificationRow } from './notifications.repository';
import { RealtimeService } from '../realtime/realtime.service';
import type { NotificationType } from '../common/types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Fire-and-forget notification sender.
   * Returns void — callers MUST NOT await this method.
   */
  send(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    metadata?: Record<string, unknown>,
  ): void {
    // intentional fire-and-forget: notifications must never block the calling operation
    void this.notificationsRepository
      .insert({ userId, type, title, body, metadata })
      .then(() => {
        this.realtimeService.emitToUser(userId, 'notification', {
          type,
          title,
          body,
          metadata,
        });
      })
      .catch(() => undefined);
  }

  findByUser(userId: string): Promise<NotificationRow[]> {
    return this.notificationsRepository.findByUser(userId);
  }

  markRead(id: string, userId: string): Promise<void> {
    return this.notificationsRepository.markRead(id, userId);
  }

  markAllRead(userId: string): Promise<void> {
    return this.notificationsRepository.markAllRead(userId);
  }
}
