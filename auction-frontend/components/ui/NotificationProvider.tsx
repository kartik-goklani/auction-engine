'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { notificationsApi } from '@/lib/api';
import { connectSocket, onNotification } from '@/lib/socket';
import type { NotificationEventPayload, NotificationRow } from '@/lib/types';
import { useToast } from './NotificationToast';

interface NotificationContextValue {
  notifications: NotificationRow[];
  unreadCount: number;
  latestNotification: NotificationRow | null;
  notificationVersion: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function upsertNotification(
  existing: NotificationRow[],
  incoming: NotificationRow,
): NotificationRow[] {
  const withoutIncoming = existing.filter((notification) => notification.id !== incoming.id);
  return [incoming, ...withoutIncoming].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [latestNotification, setLatestNotification] = useState<NotificationRow | null>(null);
  const [notificationVersion, setNotificationVersion] = useState(0);
  const toastedIdsRef = useRef<Set<string>>(new Set());

  const refreshNotifications = useCallback(async () => {
    const data = await notificationsApi.list().catch(() => null);
    if (data) {
      setNotifications(data);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    let cancelled = false;
    let detachNotification: (() => void) | null = null;

    void connectSocket().then(() => {
      if (cancelled) return;

      detachNotification = onNotification((payload: NotificationEventPayload) => {
        setNotifications((prev) => upsertNotification(prev, payload));
        setLatestNotification(payload);
        setNotificationVersion((prev) => prev + 1);

        if (!toastedIdsRef.current.has(payload.id)) {
          toastedIdsRef.current.add(payload.id);
          addToast(payload.title, payload.body ?? undefined);
        }
      });
    });

    return () => {
      cancelled = true;
      detachNotification?.();
    };
  }, [addToast]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markRead = useCallback(async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) =>
      prev.map((notification) => (
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true })),
    );
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    latestNotification,
    notificationVersion,
    markRead,
    markAllRead,
    refreshNotifications,
  }), [
    latestNotification,
    markAllRead,
    markRead,
    notificationVersion,
    notifications,
    refreshNotifications,
    unreadCount,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
}
