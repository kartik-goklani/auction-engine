'use client';

interface AuctionPausedBannerProps {
  reason?: string | null;
  onResume: () => void;
  resuming?: boolean;
}

export function AuctionPausedBanner({ reason, onResume, resuming }: AuctionPausedBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-600 text-lg">⏸</span>
        <div>
          <p className="font-semibold text-amber-900">Auction is paused</p>
          {reason && (
            <p className="mt-0.5 text-sm text-amber-700">{reason}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onResume}
        disabled={resuming}
        className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {resuming && (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        Resume Auction
      </button>
    </div>
  );
}
