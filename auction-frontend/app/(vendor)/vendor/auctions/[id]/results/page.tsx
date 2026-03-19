'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { auctionsApi, bidsApi } from '@/lib/api';
import type { AuctionRow, BidRow as BidRowData, BestBidResponse } from '@/lib/types';
import { BidStatus, AuctionStatus, AuctionType } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { BidHistory } from '@/components/bid/BidHistory';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Trophy, Frown, Clock } from 'lucide-react';
import Link from 'next/link';

export default function VendorResultsPage() {
  const { id } = useParams<{ id: string }>();

  const [auction,     setAuction]     = useState<AuctionRow | null>(null);
  const [myBids,      setMyBids]      = useState<BidRowData[]>([]);
  const [bestBidData, setBestBidData] = useState<BestBidResponse | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([auctionsApi.get(id), bidsApi.mine(id), bidsApi.best(id)])
      .then(([a, b, best]) => {
        setAuction(a);
        setMyBids(b);
        setBestBidData(best);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !auction) return <FullPageSpinner />;

  const isSealed     = auction.type === AuctionType.SEALED_BID;
  const isForward    = auction.type === AuctionType.FORWARD;
  const acceptedBids = myBids.filter((b) => b.status === BidStatus.ACCEPTED);

  // For FORWARD auctions the highest bid wins; for REVERSE/SEALED the lowest wins
  const sortedAccepted = [...acceptedBids].sort((a, b) =>
    isForward ? b.amount - a.amount : a.amount - b.amount
  );
  const bestMyBid = sortedAccepted[0] ?? null;

  const awarded  = auction.status === AuctionStatus.AWARDED;
  const closed   = auction.status === AuctionStatus.CLOSED;

  // Winner is identified by winning_vendor_id stored on the auction at award time
  const myVendorId = myBids[0]?.vendor_id ?? null;
  const iWon  = awarded && myVendorId != null && auction.winning_vendor_id === myVendorId;
  const iLost = awarded && !iWon;

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/vendor/auctions/${id}`} className="inline-flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-text-primary">{auction.title}</h1>
            <AuctionStatusBadge status={auction.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Closed {auction.end_time ? formatDate(auction.end_time) : ''}
          </p>
        </div>
      </div>

      {/* ── Outcome card ──────────────────────────────────────────────────── */}

      {iWon && (
        <div className="flex flex-col items-center gap-3 rounded-[12px] bg-gradient-to-b from-success/10 to-transparent border border-success/25 px-6 py-8">
          <Trophy size={28} className="text-success" />
          <p className="text-lg font-bold text-text-primary">You Won!</p>
          <p className="text-sm text-text-secondary">Your bid was selected for award.</p>
          <p className="font-mono text-2xl font-bold text-success mt-1">
            {formatCurrency(bestMyBid!.amount)}
          </p>
        </div>
      )}

      {iLost && (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-border-default bg-bg-elevated px-6 py-8">
          <Frown size={28} className="text-text-muted" />
          <p className="text-base font-semibold text-text-primary">Better luck next time</p>
          <p className="text-sm text-text-secondary text-center">
            The contract was awarded to another vendor.
          </p>
          {bestBidData?.bestBid?.amount != null && (
            <p className="text-xs text-text-muted mt-1">
              Winning bid: <span className="font-mono font-semibold text-text-secondary">{formatCurrency(bestBidData.bestBid.amount)}</span>
            </p>
          )}
        </div>
      )}

      {closed && (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-warning/25 bg-warning/5 px-6 py-6">
          <Clock size={24} className="text-warning" />
          <p className="text-sm font-semibold text-text-primary">Pending Award</p>
          <p className="text-xs text-text-secondary text-center">
            The auction has closed. The buyer is reviewing bids and will announce the award shortly.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[10px] bg-bg-card border border-border-subtle p-4">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">My Bids Submitted</p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{myBids.length}</p>
        </div>
        <div className="rounded-[10px] bg-bg-card border border-border-subtle p-4">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">My Best Bid</p>
          <p className="mt-1 font-mono text-xl font-bold text-text-primary">
            {bestMyBid ? formatCurrency(bestMyBid.amount) : '—'}
          </p>
        </div>
      </div>

      {/* Bid history */}
      {myBids.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            {isSealed ? 'Your Submitted Bid' : 'Your Bid History'}
          </h2>
          <BidHistory bids={myBids} />
        </Card>
      )}
    </div>
  );
}
