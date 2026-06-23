'use client';

import { Button } from '@/components/ui/Button';
import { Pause } from 'lucide-react';

interface AuctionPausedBannerProps {
  reason?: string | null;
  onResume: () => void;
  resuming?: boolean;
}

export function AuctionPausedBanner({ reason, onResume, resuming }: AuctionPausedBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 border border-warning/30 bg-warning/8 px-4 py-3 rounded-[4px]">
      <div className="flex items-center gap-3">
        <Pause size={13} className="text-warning shrink-0" />
        <div>
          <p className="text-xs font-semibold text-warning uppercase tracking-wider">Auction Paused</p>
          {reason && (
            <p className="text-[11px] text-text-secondary mt-0.5">{reason}</p>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={onResume}
        loading={resuming}
        className="bg-success hover:bg-success/90 text-[#0A0A0A] shrink-0"
      >
        Resume
      </Button>
    </div>
  );
}
