import type { BidRow as BidRowData } from '@/lib/types';
import { BidStatus } from '@/lib/types';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface BidRowProps {
  bid: BidRowData;
  /** If provided, show as "Vendor A" etc. instead of raw vendor_id */
  alias?: string;
  showVendor?: boolean;
}

const STATUS_VARIANT: Partial<Record<BidStatus, 'success' | 'danger' | 'elevated'>> = {
  [BidStatus.ACCEPTED]: 'success',
  [BidStatus.REJECTED]: 'danger',
};

export function BidRow({ bid, alias, showVendor = false }: BidRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2.5 rounded-[3px]',
        bid.status === BidStatus.ACCEPTED ? 'bg-success/8' : 'bg-bg-elevated',
      )}
    >
      <div className="flex items-center gap-3">
        {showVendor && (
          <span className="text-xs text-text-muted w-16 shrink-0">{alias ?? '—'}</span>
        )}
        <span className="font-mono text-sm font-semibold text-text-primary">
          {formatCurrency(bid.amount)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-text-muted">{formatTimeAgo(bid.submitted_at)}</span>
        <Badge variant={STATUS_VARIANT[bid.status] ?? 'elevated'} size="sm">
          {bid.status.charAt(0) + bid.status.slice(1).toLowerCase()}
        </Badge>
      </div>
    </div>
  );
}
