import { Injectable } from '@nestjs/common';
import { NotificationsRepository, type NotificationRow } from './notifications.repository';
import { RealtimeService } from '../realtime/realtime.service';
import type { NotificationType } from '../common/types';

const DEDUPE_WINDOW_MS = 10_000;

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
    void this.sendInternal(userId, type, title, body, metadata)
      .catch(() => undefined);
  }

  private async sendInternal(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const signature = this.buildSignature(type, title, body, metadata);
    const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const recentNotifications = await this.notificationsRepository.findRecentByUser(userId, sinceIso);
    const duplicateExists = recentNotifications.some((notification) => (
      this.buildSignature(
        notification.type,
        notification.title,
        notification.body ?? undefined,
        notification.metadata ?? undefined,
      ) === signature
    ));

    if (duplicateExists) {
      return;
    }

    const inserted = await this.notificationsRepository.insert({
      userId,
      type,
      title,
      body,
      metadata,
    });

    this.realtimeService.emitToUser(userId, 'notification', inserted);
  }

  private buildSignature(
    type: NotificationType,
    title: string,
    body?: string,
    metadata?: Record<string, unknown>,
  ): string {
    return JSON.stringify({
      type,
      title,
      body: body ?? null,
      metadata: metadata ?? null,
    });
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
