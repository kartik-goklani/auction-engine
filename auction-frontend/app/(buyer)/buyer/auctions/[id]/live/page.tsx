'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  connectSocket, joinAuction, leaveAuction,
  onBidAccepted, onAuctionExtended, onAuctionClosed, onAlertRaised,
} from '@/lib/socket';
import { auctionsApi, bidsApi, agentsApi } from '@/lib/api';
import type { AuctionRow, BidRow as BidRowData } from '@/lib/types';
import { AuctionStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { BidTrendChart } from '@/components/auction/BidTrendChart';
import { LiveBidFeed } from '@/components/auction/LiveBidFeed';
import { AgentTraceViewer } from '@/components/agent/AgentTraceViewer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Clock, X } from 'lucide-react';
import Link from 'next/link';

const BUYER_PLACEHOLDER = 'buyer-monitor';

export default function BuyerLivePage() {
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();

  const [auction,   setAuction]   = useState<AuctionRow | null>(null);
  const [bids,      setBids]      = useState<BidRowData[]>([]);
  const [agentRuns, setAgentRuns] = useState<Awaited<ReturnType<typeof agentsApi.runs>>>([]);
  const [loading,   setLoading]   = useState(true);
  const [extending, setExtending] = useState(false);
  const [closing,   setClosing]   = useState(false);

  const load = useCallback(async () => {
    const [a, b, runs] = await Promise.all([
      auctionsApi.get(id),
      bidsApi.list(id),
      agentsApi.runs(id),
    ]);

    // If the auction is no longer OPEN, redirect to results immediately.
    // This handles the case where a buyer navigates directly to /live for
    // a closed/awarded/cancelled auction via the URL bar.
    if (a.status !== AuctionStatus.OPEN) {
      router.replace(`/buyer/auctions/${id}/results`);
      return;
    }

    setAuction(a);
    setBids(b);
    setAgentRuns(runs);

    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Socket lifecycle
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void connectSocket().then(() => {
      if (cancelled) return;
      joinAuction(id, BUYER_PLACEHOLDER);

      const offBidAccepted = onBidAccepted(() => {
        void bidsApi.list(id).then((newBids) => {
          if (cancelled) return;
          setBids(newBids);
        });
      });

      const offExtended = onAuctionExtended((payload) => {
        setAuction((prev) => prev ? { ...prev, end_time: payload.newEndTime } : prev);
      });

      // When auction closes, redirect to results — do not reload the live page.
      const offClosed = onAuctionClosed(() => {
        router.push(`/buyer/auctions/${id}/results`);
      });

      // Anomaly alerts appear as slide-in toasts rather than inline cards,
      // keeping the monitoring view uncluttered during active bidding.
      const offAlert = onAlertRaised(() => {
        void agentsApi.alerts(id).then(() => undefined);
      });

      cleanup = () => {
        offBidAccepted();
        offExtended();
        offClosed();
        offAlert();
        leaveAuction(id);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id, router]);

  async function handleExtend() {
    setExtending(true);
    try { await auctionsApi.extendByMinutes(id, 5); await load(); }
    finally { setExtending(false); }
  }

  async function handleForceClose() {
    if (!confirm('Force close this auction now?')) return;
    setClosing(true);
    try {
      await auctionsApi.close(id);
      router.push(`/buyer/auctions/${id}/results`);
    } finally {
      setClosing(false);
    }
  }

  if (loading || !auction) return <FullPageSpinner />;

  const acceptedBids = bids.filter((bid) => bid.status === 'ACCEPTED');
  const sortedAcceptedBids = [...acceptedBids].sort((left, right) => {
    if (auction.type === 'FORWARD') {
      return right.amount - left.amount;
    }

    return left.amount - right.amount;
  });
  const currentBest = sortedAcceptedBids[0]?.amount ?? null;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/buyer/auctions/${id}`}>
            <button type="button" className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-text-primary truncate">{auction.title}</h1>
              <AuctionStatusBadge status={auction.status} pulse />
            </div>
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" loading={extending} onClick={handleExtend}>
            <Clock size={13} />
            +5 min
          </Button>
          <Button variant="danger" size="sm" loading={closing} onClick={handleForceClose}>
            <X size={13} />
            Force Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Current Best</p>
          <p className="font-mono text-3xl font-bold text-success leading-none">
            {currentBest != null ? formatCurrency(currentBest) : '—'}
          </p>
        </Card>
        {auction.end_time && (
          <Card className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Time Remaining</p>
            <AuctionTimer endTime={auction.end_time} className="text-xl" />
          </Card>
        )}
        <Card className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Total Bids</p>
          <p className="font-mono text-2xl font-bold text-text-primary">{bids.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Price Trend</h2>
          </div>
          <BidTrendChart bids={bids} auctionType={auction.type} />
        </Card>

        <Card className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-text-primary flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live Bid Feed
          </p>
          <LiveBidFeed bids={bids} className="max-h-[420px]" />
        </Card>
      </div>

      {/* Agent traces */}
      {agentRuns.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Agent Activity</h2>
          <AgentTraceViewer runs={agentRuns} />
        </Card>
      )}
    </div>
  );
}
