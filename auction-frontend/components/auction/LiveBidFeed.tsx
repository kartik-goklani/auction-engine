'use client';

import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { BidRow } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LiveBidFeedProps {
  bids: BidRow[];
  className?: string;
}

export function LiveBidFeed({ bids, className }: LiveBidFeedProps) {
  const acceptedBids = bids
    .filter((bid) => bid.status === 'ACCEPTED')
    .slice(0, 50);

  if (acceptedBids.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
        <Zap size={20} className="mb-2 text-text-muted" />
        <p className="text-xs text-text-muted">Waiting for bids…</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1 overflow-y-auto', className)}>
      <AnimatePresence initial={false}>
        {acceptedBids.map((entry, idx) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={cn(
              'flex items-center justify-between rounded-[3px] px-3 py-2',
              idx === 0
                ? 'bg-success/8 border border-success/25 border-l-2 border-l-success'
                : 'bg-bg-elevated border border-transparent',
            )}
          >
            <div className="flex items-center gap-2">
              {idx === 0 && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              )}
              <span className="font-mono text-sm font-semibold text-accent">
                {formatCurrency(entry.amount)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-text-muted">Bid #{acceptedBids.length - idx}</span>
              <span className="text-[10px] text-text-muted">
                {new Date(entry.submitted_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
