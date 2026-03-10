import { cn } from '@/lib/utils';

interface RankBadgeProps {
  rank: number;
  totalBidders: number;
  className?: string;
}

/**
 * Displays a vendor's current rank with colour coding.
 * Rank 1 = winning position (green). Top half = amber. Otherwise red.
 */
export function RankBadge({ rank, totalBidders, className }: RankBadgeProps) {
  const isFirst  = rank === 1;
  const isTopHalf = rank <= Math.ceil(totalBidders / 2);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
        isFirst
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
          isFirst ? 'text-success' : isTopHalf ? 'text-warning' : 'text-danger',
        )}
      >
        #{rank}
      </span>
      <span className="text-[10px] text-text-muted">of {totalBidders}</span>
    </div>
  );
}
