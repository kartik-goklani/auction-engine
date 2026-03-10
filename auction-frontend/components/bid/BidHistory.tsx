import type { BidRow as BidRowData } from '@/lib/types';
import { vendorAlias } from '@/lib/utils';
import { BidRow } from './BidRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Gavel } from 'lucide-react';

interface BidHistoryProps {
  bids: BidRowData[];
  /** Show anonymised vendor aliases (buyer view) */
  showVendors?: boolean;
  /** Map of vendorId → stable index for alias generation */
  vendorIndexMap?: Map<string, number>;
}

export function BidHistory({ bids, showVendors = false, vendorIndexMap }: BidHistoryProps) {
  if (bids.length === 0) {
    return (
      <EmptyState
        icon={<Gavel size={20} />}
        title="No bids yet"
        description="Bids will appear here as vendors place them."
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {bids.map((bid) => {
        const idx = showVendors ? (vendorIndexMap?.get(bid.vendor_id) ?? 0) : 0;
        return (
          <BidRow
            key={bid.id}
            bid={bid}
            showVendor={showVendors}
            alias={showVendors ? vendorAlias(bid.vendor_id, idx) : undefined}
          />
        );
      })}
    </div>
  );
}
