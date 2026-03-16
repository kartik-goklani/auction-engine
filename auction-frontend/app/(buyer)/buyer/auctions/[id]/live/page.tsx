'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  connectSocket, joinAuction, leaveAuction,
  onBidAccepted, onAuctionExtended, onAuctionClosed, onAlertRaised, onAgentRunCompleted,
  onAuctionPaused, onAuctionResumed, onParticipantsChanged, onAuctionCancelled, onReconnect,
} from '@/lib/socket';
import { auctionsApi, bidsApi, agentsApi } from '@/lib/api';
import type { AuctionRow, BidRow as BidRowData, ReserveNotMetDetails } from '@/lib/types';
import { AuctionStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { BidTrendChart } from '@/components/auction/BidTrendChart';
import { LiveBidFeed } from '@/components/auction/LiveBidFeed';
import { AgentTraceViewer } from '@/components/agent/AgentTraceViewer';
import { PauseAuctionModal } from '@/components/auction/PauseAuctionModal';
import { ReserveNotMetModal } from '@/components/auction/ReserveNotMetModal';
import { AuctionPausedBanner } from '@/components/auction/AuctionPausedBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Clock, X, Pause, Play } from 'lucide-react';
import Link from 'next/link';

const BUYER_PLACEHOLDER = 'buyer-monitor';

export default function BuyerLivePage() {
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();

  const [auction,        setAuction]        = useState<AuctionRow | null>(null);
  const [bids,           setBids]           = useState<BidRowData[]>([]);
  const [agentRuns,      setAgentRuns]      = useState<Awaited<ReturnType<typeof agentsApi.runs>>>([]);
  const [vendorCount,    setVendorCount]    = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [extending,      setExtending]      = useState(false);
  const [closing,        setClosing]        = useState(false);
  const [pauseModalOpen,       setPauseModalOpen]       = useState(false);
  const [pausing,              setPausing]              = useState(false);
  const [resuming,             setResuming]             = useState(false);
  const [reserveModalOpen,     setReserveModalOpen]     = useState(false);
  const [reserveNotMetDetails, setReserveNotMetDetails] = useState<ReserveNotMetDetails | null>(null);

  const load = useCallback(async () => {
    const [a, b, runs] = await Promise.all([
      auctionsApi.get(id),
      bidsApi.list(id),
      agentsApi.runs(id),
    ]);

    // If the auction is no longer OPEN, PAUSED, or RESERVE_NOT_MET, redirect to results.
    // PAUSED is allowed so the buyer stays on the live page while paused.
    // RESERVE_NOT_MET is allowed so the reserve modal can be shown without navigating away.
    if (
      a.status !== AuctionStatus.OPEN &&
      a.status !== AuctionStatus.PAUSED &&
      a.status !== AuctionStatus.RESERVE_NOT_MET
    ) {
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

      // Refresh agent trace list whenever any agent run completes.
      const offAgentRun = onAgentRunCompleted(() => {
        void agentsApi.runs(id).then((newRuns) => {
          if (cancelled) return;
          setAgentRuns(newRuns);
        });
      });

      const offPaused = onAuctionPaused(() => {
        setAuction((prev) => prev ? { ...prev, status: AuctionStatus.PAUSED } : prev);
      });

      const offResumed = onAuctionResumed(() => {
        setAuction((prev) => prev ? { ...prev, status: AuctionStatus.OPEN } : prev);
      });

      const offParticipants = onParticipantsChanged((p) => setVendorCount(p.vendorCount));

      const offCancelled = onAuctionCancelled(() => {
        router.push(`/buyer/auctions/${id}/results`);
      });

      const offReconnect = onReconnect(() => {
        joinAuction(id, BUYER_PLACEHOLDER);
        void load();
      });

      cleanup = () => {
        offBidAccepted();
        offExtended();
        offClosed();
        offAlert();
        offAgentRun();
        offPaused();
        offResumed();
        offParticipants();
        offCancelled();
        offReconnect();
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

  async function handleCloseNow() {
    if (!confirm('Close this auction now?')) return;
    setClosing(true);
    try {
      const result = await auctionsApi.close(id);
      if (result.status === AuctionStatus.RESERVE_NOT_MET && result.reserveNotMetDetails) {
        setReserveNotMetDetails(result.reserveNotMetDetails);
        setReserveModalOpen(true);
      } else {
        router.push(`/buyer/auctions/${id}/results`);
      }
    } finally {
      setClosing(false);
    }
  }

  async function handleForceClose() {
    await auctionsApi.forceClose(id);
    setReserveModalOpen(false);
    router.push(`/buyer/auctions/${id}/results`);
  }

  async function handleExtendFromReserve() {
    setReserveModalOpen(false);
    setExtending(true);
    try { await auctionsApi.extendByMinutes(id, 5); await load(); }
    finally { setExtending(false); }
  }

  async function handlePause(reason?: string) {
    setPausing(true);
    try {
      const updated = await auctionsApi.pauseAuction(id, reason);
      setAuction(updated);
    } finally {
      setPausing(false);
      setPauseModalOpen(false);
    }
  }

  async function handleResume() {
    setResuming(true);
    try {
      const updated = await auctionsApi.resumeAuction(id);
      setAuction(updated);
    } finally {
      setResuming(false);
    }
  }

  if (loading || !auction) return <FullPageSpinner />;

  const isPaused = auction.status === AuctionStatus.PAUSED;
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
          {!isPaused ? (
            <>
              <Button variant="secondary" size="sm" loading={extending} onClick={handleExtend}>
                <Clock size={13} />
                +5 min
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={pausing}
                onClick={() => setPauseModalOpen(true)}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Pause size={13} />
                Pause
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" loading={resuming} onClick={handleResume} className="border-green-300 text-green-700 hover:bg-green-50">
              <Play size={13} />
              Resume
            </Button>
          )}
          <Button variant="danger" size="sm" loading={closing} onClick={handleCloseNow}>
            <X size={13} />
            Close Now
          </Button>
        </div>
      </div>

      {/* Paused banner — shown between controls and metrics */}
      {isPaused && (
        <AuctionPausedBanner
          reason={auction.pause_reason}
          onResume={handleResume}
          resuming={resuming}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Card className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Vendors Connected</p>
          <p className="font-mono text-2xl font-bold text-text-primary">{vendorCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Price Trend</h2>
          </div>
          <BidTrendChart
            bids={bids}
            auctionType={auction.type}
            ceilingPrice={auction.ceiling_price}
            isLive={true}
            trafficLightConfig={{
              enabled:   auction.traffic_light_enabled,
              greenPct:  auction.traffic_light_green_pct,
              yellowPct: auction.traffic_light_yellow_pct,
            }}
            anomalyAlerts={[]}
          />
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

      <PauseAuctionModal
        isOpen={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        onConfirm={handlePause}
      />

      {reserveNotMetDetails && (
        <ReserveNotMetModal
          open={reserveModalOpen}
          bestBid={reserveNotMetDetails.best_bid}
          reservePrice={reserveNotMetDetails.reserve_price}
          gapAmount={reserveNotMetDetails.gap_amount}
          gapPct={reserveNotMetDetails.gap_pct}
          onForceClose={handleForceClose}
          onExtend={handleExtendFromReserve}
          onOpenChange={setReserveModalOpen}
        />
      )}
    </div>
  );
}
