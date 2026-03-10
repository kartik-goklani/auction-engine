'use client';

import { useState } from 'react';
import type { AuctionAlertRow } from '@/lib/types';
import { AlertSeverity } from '@/lib/types';
import { formatTimeAgo } from '@/lib/utils';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnomalyAlertCardProps {
  alert: AuctionAlertRow;
  onDismiss?: (alertId: string) => void;
}

const SEVERITY_CONFIG: Record<AlertSeverity, {
  icon: typeof AlertTriangle;
  colors: string;
}> = {
  [AlertSeverity.LOW]:    { icon: Info,         colors: 'border-accent-blue/30 bg-accent-blue/5 text-accent-blue' },
  [AlertSeverity.MEDIUM]: { icon: AlertTriangle, colors: 'border-warning/30    bg-warning/5      text-warning'     },
  [AlertSeverity.HIGH]:   { icon: AlertTriangle, colors: 'border-danger/30     bg-danger/5       text-danger'      },
};

export function AnomalyAlertCard({ alert, onDismiss }: AnomalyAlertCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = SEVERITY_CONFIG[alert.severity];
  const Icon   = config.icon;

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.(alert.id);
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        'transition-all duration-300',
        config.colors,
      )}
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-text-primary">{alert.alert_type.replace(/_/g, ' ')}</p>
        <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">{alert.description}</p>
        <p className="mt-1 text-[10px] text-text-muted">{formatTimeAgo(alert.created_at)}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 text-text-muted hover:text-text-secondary transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
