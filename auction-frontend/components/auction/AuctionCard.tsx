import type { AuctionRow } from '@/lib/types';
import { AuctionStatus, AuctionType } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { AuctionStatusBadge } from './AuctionStatusBadge';
import { AuctionTypeTag } from './AuctionTypeTag';
import { AuctionTimer } from './AuctionTimer';

interface AuctionCardProps {
  auction: AuctionRow;
  onClick?: () => void;
}

const STATUS_BORDER: Record<AuctionStatus, string> = {
  [AuctionStatus.DRAFT]:     'border-l-border-default',
  [AuctionStatus.PUBLISHED]: 'border-l-warning',
  [AuctionStatus.OPEN]:      'border-l-success',
  [AuctionStatus.PAUSED]:    'border-l-warning',
  [AuctionStatus.CLOSED]:    'border-l-text-muted',
  [AuctionStatus.AWARDED]:   'border-l-accent',
  [AuctionStatus.CANCELLED]: 'border-l-danger',
};

export function AuctionCard({ auction, onClick }: AuctionCardProps) {
  const isLive     = auction.status === AuctionStatus.OPEN;
  const hasCeiling = auction.ceiling_price != null;
  const borderLeft = STATUS_BORDER[auction.status] ?? 'border-l-border-default';

  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={`flex flex-col gap-0 p-0 border-l-4 ${borderLeft}`}
    >
      {/* Main content */}
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 pl-5">
        {/* Header row: title + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug text-text-primary">
              {auction.title}
            </p>
            {auction.description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-text-muted">
                {auction.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <AuctionStatusBadge status={auction.status} pulse />
            <AuctionTypeTag type={auction.type} />
          </div>
        </div>

        {/* Price metric */}
        {hasCeiling && (
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              {auction.type === AuctionType.FORWARD ? 'Floor' : 'Ceiling'}
            </span>
            <span className="font-mono text-base font-bold text-text-primary">
              {formatCurrency(auction.ceiling_price!)}
            </span>
          </div>
        )}

        {/* Category chip */}
        {auction.category && (
          <div>
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-medium tracking-wide text-text-secondary">
              {auction.category}
            </span>
          </div>
        )}
      </div>

      {/* Time strip — always shows both START and END */}
      <div className="mt-1 grid grid-cols-2 divide-x divide-border-subtle border-t border-border-subtle">
        <div className="flex flex-col gap-0.5 py-2.5 pl-5 pr-3">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Start
          </span>
          <span className="text-[11px] font-medium tabular-nums text-text-secondary">
            {auction.start_time ? formatDate(auction.start_time) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-2.5">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            End
          </span>
          <div className="text-[11px] font-medium tabular-nums text-text-secondary">
            {isLive && auction.end_time ? (
              <AuctionTimer endTime={auction.end_time} />
            ) : (
              <span>{auction.end_time ? formatDate(auction.end_time) : '—'}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
