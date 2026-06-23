'use client';

import { Pause } from 'lucide-react';

interface AuctionPausedVendorBannerProps {
  reason?: string | null;
}

export function AuctionPausedVendorBanner({ reason }: AuctionPausedVendorBannerProps) {
  return (
    <div className="flex items-start gap-3 border border-warning/30 bg-warning/8 px-4 py-3 rounded-[4px]">
      <Pause size={13} className="text-warning shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-warning uppercase tracking-wider">Auction Temporarily Paused</p>
        <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
          The organiser has suspended bidding. The auction will resume shortly — please wait.
        </p>
        {reason && (
          <p className="mt-1.5 text-[11px] font-medium text-text-muted border-l border-warning/40 pl-2">{reason}</p>
        )}
      </div>
    </div>
  );
}
