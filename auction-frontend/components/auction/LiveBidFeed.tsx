'use client';

import { Zap } from 'lucide-react';
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
      {acceptedBids.map((entry, idx) => (
        <div
          key={entry.id}
          className={cn(
            'flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-700',
            idx === 0
              ? 'bg-success/10 border border-success/25'
              : 'bg-bg-elevated border border-transparent',
          )}
        >
          <div className="flex items-center gap-2">
            {idx === 0 && (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            )}
            <span className="font-mono text-sm font-semibold text-text-primary">
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
        </div>
      ))}
    </div>
  );
}
