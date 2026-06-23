'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  [AlertSeverity.LOW]:    { icon: Info,         colors: 'border-border-default bg-bg-elevated text-text-muted'    },
  [AlertSeverity.MEDIUM]: { icon: AlertTriangle, colors: 'border-warning/30    bg-warning/8      text-warning'     },
  [AlertSeverity.HIGH]:   { icon: AlertTriangle, colors: 'border-danger/30     bg-danger/8       text-danger'      },
};

// HIGH severity alerts get a brief attention pulse after entering
const HIGH_SEVERITY_SEQUENCE = {
  hidden:  { opacity: 0, x: 20, scale: 0.97 },
  visible: {
    opacity: 1, x: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 380, damping: 28 },
  },
  exit:    { opacity: 0, x: 20, scale: 0.97, transition: { duration: 0.18, ease: 'easeIn' as const } },
};

const DEFAULT_SEQUENCE = {
  hidden:  { opacity: 0, x: 14, scale: 0.98 },
  visible: {
    opacity: 1, x: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 320, damping: 30 },
  },
  exit:    { opacity: 0, x: 14, scale: 0.98, transition: { duration: 0.18, ease: 'easeIn' as const } },
};

export function AnomalyAlertCard({ alert, onDismiss }: AnomalyAlertCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const config   = SEVERITY_CONFIG[alert.severity];
  const Icon     = config.icon;
  const variants = alert.severity === AlertSeverity.HIGH ? HIGH_SEVERITY_SEQUENCE : DEFAULT_SEQUENCE;

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.(alert.id);
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            'flex items-start gap-3 rounded-[4px] border px-4 py-3',
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
            <motion.button
              type="button"
              onClick={handleDismiss}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="shrink-0 text-text-muted hover:text-text-secondary transition-colors"
            >
              <X size={13} />
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
