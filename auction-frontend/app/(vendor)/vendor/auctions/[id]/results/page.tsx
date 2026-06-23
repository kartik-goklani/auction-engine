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
import { ArrowLeft, Trophy, Clock, TrendingDown } from 'lucide-react';
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

  const isSealed   = auction.type === AuctionType.SEALED_BID;
  const isForward  = auction.type === AuctionType.FORWARD;
  const acceptedBids = myBids.filter((b) => b.status === BidStatus.ACCEPTED);

  const sortedAccepted = [...acceptedBids].sort((a, b) =>
    isForward ? b.amount - a.amount : a.amount - b.amount,
  );
  const bestMyBid = sortedAccepted[0] ?? null;

  const awarded  = auction.status === AuctionStatus.AWARDED;
  const closed   = auction.status === AuctionStatus.CLOSED;
  const myVendorId = myBids[0]?.vendor_id ?? null;
  const iWon  = awarded && myVendorId != null && auction.winning_vendor_id === myVendorId;
  const iLost = awarded && !iWon;

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/vendor/auctions/${id}`}
          className="mt-0.5 inline-flex items-center justify-center p-1.5 rounded-[3px] text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <ArrowLeft size={14} />
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold tracking-tight text-text-primary">{auction.title}</h1>
            <AuctionStatusBadge status={auction.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Closed {auction.end_time ? formatDate(auction.end_time) : ''}
          </p>
        </div>
      </div>

      {/* ── Outcome banner ──────────────────────────────────────────────── */}

      {iWon && (
        <div className="relative overflow-hidden border border-accent/40 bg-accent-dim rounded-[4px] border-l-2 border-l-accent px-6 py-6">
          {/* Amber glow — subtle radial */}
          <div className="pointer-events-none absolute inset-0 opacity-20"
            style={{ background: 'radial-gradient(ellipse at 0% 50%, #C8A96E 0%, transparent 60%)' }}
          />
          <div className="relative flex items-center gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-accent text-[#0A0A0A] rounded-[4px]">
              <Trophy size={22} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-text-primary">Contract Awarded</p>
              <p className="text-xs text-text-secondary mt-0.5">Your bid was selected. Expect the buyer to be in touch.</p>
            </div>
            {bestMyBid && (
              <p className="font-mono text-2xl font-bold text-accent shrink-0">
                {formatCurrency(bestMyBid.amount)}
              </p>
            )}
          </div>
        </div>
      )}

      {iLost && (
        <div className="border border-border-default bg-bg-card rounded-[4px] border-l-2 border-l-border-default px-6 py-6">
          <div className="flex items-center gap-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-bg-elevated border border-border-default rounded-[4px]">
              <TrendingDown size={18} className="text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">Not Selected</p>
              <p className="text-xs text-text-secondary mt-0.5">
                The contract was awarded to another vendor. Thank you for competing.
              </p>
            </div>
            {bestBidData?.bestBid?.amount != null && (
              <div className="shrink-0 border border-border-subtle bg-bg-elevated px-4 py-2.5 rounded-[4px] text-right">
                <p className="text-[9px] uppercase tracking-widest text-text-muted">Winning Bid</p>
                <p className="font-mono text-base font-semibold text-text-secondary mt-0.5">
                  {formatCurrency(bestBidData.bestBid.amount)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {closed && (
        <div className="flex items-start gap-3 border border-warning/25 bg-warning/5 rounded-[4px] border-l-2 border-l-warning px-5 py-5">
          <Clock size={16} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Pending Award</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              The auction has closed. The buyer is reviewing bids and will announce the award shortly.
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-[4px] bg-bg-card border border-border-subtle p-4">
          <p className="text-[9px] uppercase tracking-widest text-text-muted">Bids Submitted</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-text-primary">{myBids.length}</p>
        </div>
        <div className={[
          'rounded-[4px] bg-bg-card border border-border-subtle p-4 border-l-2',
          iWon ? 'border-l-accent' : 'border-l-border-default',
        ].join(' ')}>
          <p className="text-[9px] uppercase tracking-widest text-text-muted">My Best Bid</p>
          <p className={[
            'mt-1.5 font-mono text-xl font-bold',
            iWon ? 'text-accent' : 'text-text-primary',
          ].join(' ')}>
            {bestMyBid ? formatCurrency(bestMyBid.amount) : '—'}
          </p>
        </div>
      </div>

      {/* ── Bid history ─────────────────────────────────────────────────── */}
      {myBids.length > 0 && (
        <Card padding="sm">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3 px-1">
            {isSealed ? 'Your Submitted Bid' : 'Bid History'}
          </h2>
          <BidHistory bids={myBids} />
        </Card>
      )}
    </div>
  );
}
