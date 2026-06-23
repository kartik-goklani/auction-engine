'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface RankBadgeProps {
  /** null = vendor has not yet placed a bid; show placeholder */
  rank: number | null;
  totalBidders: number;
  className?: string;
}

/**
 * Displays a vendor's current rank with colour coding.
 * rank=null means the vendor hasn't bid yet — shows "--" with a neutral style.
 * Rank 1 = winning position (green). Top half = amber. Otherwise red.
 * The rank number animates (flip up) whenever it changes.
 */
export function RankBadge({ rank, totalBidders, className }: RankBadgeProps) {
  const isFirst    = rank === 1;
  const isTopHalf  = rank !== null && rank <= Math.ceil(totalBidders / 2);
  const isUnranked = rank === null;

  const numberColor = cn(
    'font-mono text-lg font-bold leading-none',
    isUnranked
      ? 'text-text-muted'
      : isFirst
      ? 'text-success'
      : isTopHalf
      ? 'text-warning'
      : 'text-danger',
  );

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 overflow-hidden',
        isUnranked
          ? 'bg-bg-elevated border border-border-default'
          : isFirst
          ? 'bg-success/8 border border-success/25'
          : isTopHalf
          ? 'bg-warning/8 border border-warning/25'
          : 'bg-danger/8  border border-danger/25',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={rank}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{   y: -10, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={numberColor}
        >
          {isUnranked ? '--' : `#${rank}`}
        </motion.span>
      </AnimatePresence>
      <span className="text-[10px] text-text-muted">of {totalBidders}</span>
    </div>
  );
}
