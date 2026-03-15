'use client';

interface AuctionPausedVendorBannerProps {
  reason?: string | null;
}

export function AuctionPausedVendorBanner({ reason }: AuctionPausedVendorBannerProps) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl text-amber-600">⏸</span>
        <div>
          <p className="font-semibold text-amber-900">Auction temporarily paused</p>
          <p className="mt-1 text-sm text-amber-700">
            The organiser has temporarily suspended bidding. Please wait — the auction will resume shortly.
          </p>
          {reason && (
            <p className="mt-2 text-sm font-medium text-amber-800">{reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
