import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import type { NotificationType } from '../common/types';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async insert(entry: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.getClient().from('notifications').insert({
      user_id: entry.userId,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      metadata: entry.metadata ?? null,
    });
  }

  async findByUser(userId: string): Promise<NotificationRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to fetch notifications');
    }
    return (data ?? []) as NotificationRow[];
  }

  async markRead(id: string, userId: string): Promise<void> {
    const { error } = await this.db
      .getClient()
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new InternalServerErrorException('Failed to mark notification as read');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.db
      .getClient()
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw new InternalServerErrorException('Failed to mark all notifications as read');
    }
  }
}
