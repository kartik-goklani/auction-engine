'use client';

import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';
import { secondsUntil, formatCountdown } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AuctionTimerProps {
  endTime: string;
  /** Called when the timer reaches zero */
  onExpire?: () => void;
  className?: string;
}

/**
 * Counts down to endTime. Turns amber below 5 min, red below 1 min.
 * Fires onExpire once when the clock hits zero.
 */
export function AuctionTimer({ endTime, onExpire, className }: AuctionTimerProps) {
  const [seconds, setSeconds] = useState(() => secondsUntil(endTime));
  const expiredRef = { current: false };

  useEffect(() => {
    expiredRef.current = false;
    const tick = setInterval(() => {
      const remaining = secondsUntil(endTime);
      setSeconds(remaining);
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime]);

  const isUrgent  = seconds > 0 && seconds <= 60;
  const isWarning = seconds > 60 && seconds <= 300;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums',
        isUrgent  ? 'text-danger'  :
        isWarning ? 'text-warning' :
                    'text-text-primary',
        isUrgent && 'animate-pulse',
        className,
      )}
    >
      <Timer size={14} className="shrink-0" />
      {seconds === 0 ? 'Closed' : formatCountdown(seconds)}
    </span>
  );
}
