'use client';

import { motion } from 'motion/react';
import type { AuctionRow } from '@/lib/types';
import { AuctionStatus, AuctionType } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AuctionStatusBadge } from './AuctionStatusBadge';
import { AuctionTypeTag } from './AuctionTypeTag';
import { AuctionTimer } from './AuctionTimer';

interface AuctionCardProps {
  auction: AuctionRow;
  onClick?: () => void;
}

const STATUS_ACCENT: Record<AuctionStatus, string> = {
  [AuctionStatus.DRAFT]:           'border-l-border-default',
  [AuctionStatus.PUBLISHED]:       'border-l-warning',
  [AuctionStatus.OPEN]:            'border-l-success',
  [AuctionStatus.PAUSED]:          'border-l-warning',
  [AuctionStatus.RESERVE_NOT_MET]: 'border-l-danger',
  [AuctionStatus.CLOSED]:          'border-l-border-default',
  [AuctionStatus.AWARDED]:         'border-l-accent',
  [AuctionStatus.CANCELLED]:       'border-l-danger',
};

export function AuctionCard({ auction, onClick }: AuctionCardProps) {
  const isLive       = auction.status === AuctionStatus.OPEN;
  const hasCeiling   = auction.ceiling_price != null;
  const accentBorder = STATUS_ACCENT[auction.status] ?? 'border-l-border-default';

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      whileHover={onClick ? { y: -2, transition: { duration: 0.15 } } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={[
        'flex flex-col bg-bg-card border border-border-subtle border-l-2',
        accentBorder,
        'rounded-[4px] overflow-hidden',
        onClick && 'cursor-pointer hover:bg-bg-card-hover transition-colors duration-150',
      ].filter(Boolean).join(' ')}
    >
      {/* Main content */}
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-snug text-text-primary">
              {auction.title}
            </p>
            {auction.description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
                {auction.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <AuctionStatusBadge status={auction.status} pulse />
            <AuctionTypeTag type={auction.type} />
          </div>
        </div>

        {/* Price — the signature data element in amber mono */}
        {hasCeiling && (
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] uppercase tracking-widest text-text-muted">
              {auction.type === AuctionType.FORWARD ? 'Floor' : 'Ceiling'}
            </span>
            <span className="font-mono text-base font-semibold text-accent">
              {formatCurrency(auction.ceiling_price!)}
            </span>
          </div>
        )}

        {/* Category chip */}
        {auction.category && (
          <span className="inline-flex self-start bg-bg-tag px-2 py-0.5 text-[9px] font-medium tracking-wider uppercase text-text-muted rounded-[2px]">
            {auction.category}
          </span>
        )}
      </div>

      {/* Time strip */}
      <div className="grid grid-cols-2 divide-x divide-border-subtle border-t border-border-subtle">
        <div className="flex flex-col gap-0.5 py-2.5 px-4">
          <span className="text-[8px] font-semibold uppercase tracking-widest text-text-muted">
            Start
          </span>
          <span className="text-[11px] font-mono text-text-secondary tabular-nums">
            {auction.start_time ? formatDate(auction.start_time) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-2.5 px-4">
          <span className="text-[8px] font-semibold uppercase tracking-widest text-text-muted">
            End
          </span>
          <div className="text-[11px] font-mono text-text-secondary tabular-nums">
            {isLive && auction.end_time ? (
              <AuctionTimer endTime={auction.end_time} />
            ) : (
              <span>{auction.end_time ? formatDate(auction.end_time) : '—'}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
