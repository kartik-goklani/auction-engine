'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNotifications } from './NotificationProvider';

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-bg-card text-text-secondary transition-colors duration-150 hover:text-text-primary hover:bg-bg-elevated"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--inverse-control-border)] bg-[var(--inverse-control-bg)] px-1 text-[8px] font-bold leading-none text-[var(--inverse-control-text)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] rounded-[14px] bg-bg-card border border-border-subtle shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <p className="text-[13px] font-semibold text-text-primary">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                <Bell size={20} className="text-text-muted opacity-50" />
                <p className="text-xs text-text-muted">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={[
                    'flex items-start gap-3 px-4 py-3 border-b border-border-subtle last:border-0 transition-colors',
                    n.read ? 'opacity-60' : 'bg-accent/[0.04]',
                  ].join(' ')}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {n.read ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-text-primary leading-snug">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-text-muted mt-1 opacity-60">
                      {formatDate(n.created_at)}
                    </p>
                  </div>

                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="shrink-0 p-1 rounded text-text-muted hover:text-success transition-colors"
                      title="Mark as read"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
