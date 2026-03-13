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
 */
export function RankBadge({ rank, totalBidders, className }: RankBadgeProps) {
  const isFirst   = rank === 1;
  const isTopHalf = rank !== null && rank <= Math.ceil(totalBidders / 2);
  const isUnranked = rank === null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
        isUnranked
          ? 'bg-surface-elevated border border-border-default'
          : isFirst
          ? 'bg-success/10 border border-success/25'
          : isTopHalf
          ? 'bg-warning/10 border border-warning/25'
          : 'bg-danger/10  border border-danger/25',
        className,
      )}
    >
      <span
        className={cn(
          'font-mono text-lg font-bold leading-none',
          isUnranked
            ? 'text-text-muted'
            : isFirst
            ? 'text-success'
            : isTopHalf
            ? 'text-warning'
            : 'text-danger',
        )}
      >
        {isUnranked ? '--' : `#${rank}`}
      </span>
      <span className="text-[10px] text-text-muted">of {totalBidders}</span>
    </div>
  );
}
