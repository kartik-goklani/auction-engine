'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  connectSocket, joinAuction, leaveAuction,
  onBidAccepted, onBidRejected, onBidConfirmed,
  onAuctionExtended, onAuctionClosed, onYourRank, onOutbid,
  onAuctionPaused, onAuctionResumed, onAuctionAwarded, onAuctionCancelled, onReconnect,
} from '@/lib/socket';
import { auctionsApi, bidsApi, invitationsApi } from '@/lib/api';
import { getAccessToken } from '@/lib/supabase';
import type { AuctionRow, InvitationRow, YourRankPayload } from '@/lib/types';
import { AuctionType, AuctionVisibility, InvitationStatus, TrafficLightStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { AuctionPausedVendorBanner } from '@/components/auction/AuctionPausedVendorBanner';
import { BidInput } from '@/components/bid/BidInput';
import { RankBadge } from '@/components/bid/RankBadge';
import { TrafficLightBadge } from '@/components/bid/TrafficLightBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { message: string; kind: ToastKind }

export default function VendorBidPage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();

  const [auction,      setAuction]      = useState<AuctionRow | null>(null);
  const [invitation,   setInvitation]   = useState<InvitationRow | null>(null);
  const [vendorId,     setVendorId]     = useState<string>('');
  const [currentBest,  setCurrentBest]  = useState<number | null>(null);
  const [rankInfo,     setRankInfo]     = useState<YourRankPayload | null>(null);
  const [totalVendors, setTotalVendors] = useState<number>(0);
  const [toast,        setToast]        = useState<Toast | null>(null);
  const [isOutbid,     setIsOutbid]     = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [responding,   setResponding]   = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [isPaused,     setIsPaused]     = useState(false);
  const [pauseReason,  setPauseReason]  = useState<string | undefined>();
  const [trafficLight, setTrafficLight] = useState<TrafficLightStatus>(TrafficLightStatus.DISABLED);

  function showToast(message: string, kind: ToastKind) {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async () => {
    const [a, bestResponse, invitations] = await Promise.all([
      auctionsApi.get(id),
      bidsApi.best(id).catch(() => null),
      invitationsApi.mine().catch(() => []),
    ]);
    setAuction(a);
    setCurrentBest(bestResponse?.bestBid?.amount ?? null);
    setTotalVendors(bestResponse?.acceptedVendorCount ?? 0);
    const currentInvitation = invitations.find((item) => item.auction_id === id) ?? null;
    setInvitation(currentInvitation);
    if (a.status === 'OPEN' && currentInvitation?.status !== InvitationStatus.ACCEPTED) {
      setAccessModalOpen(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setVendorId(payload.sub as string);
      } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    if (!vendorId || invitation?.status !== InvitationStatus.ACCEPTED) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void connectSocket().then(() => {
      if (cancelled) return;

      joinAuction(id, vendorId);

      const offBidAccepted  = onBidAccepted((p) => { setCurrentBest(p.currentBestAmount ?? null); setIsOutbid(false); });
      const offBidRejected  = onBidRejected((p) => { showToast(`Bid rejected: ${p.reason}`, 'error'); });
      const offBidConfirmed = onBidConfirmed((p) => {
        showToast(`Bid ${formatCurrency(p.amount)} confirmed`, 'success');
        if (p.traffic_light) setTrafficLight(p.traffic_light);
      });
      const offYourRank = onYourRank((p) => {
        setRankInfo(p);
        setTotalVendors(p.totalActiveBidders);
        if (p.traffic_light) setTrafficLight(p.traffic_light);
      });
      const offOutbid = onOutbid((p) => {
        setIsOutbid(true);
        setCurrentBest(p.currentBestAmount);
        showToast(`Outbid — new best: ${formatCurrency(p.currentBestAmount)}`, 'info');
      });
      const offExtended  = onAuctionExtended((p) => {
        setAuction((prev) => prev ? { ...prev, end_time: p.newEndTime } : prev);
        showToast(`Auction extended by ${p.extensionMinutes} min`, 'info');
      });
      const offClosed    = onAuctionClosed(() => {
        showToast('Auction closed — redirecting to results…', 'info');
        setTimeout(() => router.push(`/vendor/auctions/${id}/results`), 3000);
      });
      const offPaused    = onAuctionPaused((p) => { setIsPaused(true); setPauseReason(p.reason); });
      const offResumed   = onAuctionResumed(() => { setIsPaused(false); setPauseReason(undefined); showToast('Auction resumed', 'info'); });
      const offAwarded   = onAuctionAwarded(() => { showToast('Auction awarded — redirecting…', 'info'); setTimeout(() => router.push(`/vendor/auctions/${id}/results`), 3_000); });
      const offCancelled = onAuctionCancelled(() => { showToast('Auction cancelled', 'info'); setTimeout(() => router.push(`/vendor/auctions/${id}/results`), 3_000); });
      const offReconnect = onReconnect(() => { joinAuction(id, vendorId); void load(); });

      cleanup = () => {
        offBidAccepted(); offBidRejected(); offBidConfirmed();
        offYourRank(); offOutbid(); offExtended(); offClosed();
        offPaused(); offResumed(); offAwarded(); offCancelled(); offReconnect();
        leaveAuction(id);
      };
    });

    return () => { cancelled = true; cleanup?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, invitation?.status, router, vendorId]);

  async function handleAcceptInvitation() {
    if (!invitation) return;
    setResponding(true);
    try {
      const updated = await invitationsApi.respond(invitation.id, 'ACCEPTED');
      setInvitation(updated);
      setAccessModalOpen(false);
    } finally {
      setResponding(false);
    }
  }

  async function handleBidSubmit(amountPaise: number) {
    await bidsApi.submit(id, amountPaise);
  }

  if (loading || !auction) return <FullPageSpinner />;

  const isSealed   = auction.type === AuctionType.SEALED_BID;
  const showRank   = !isSealed && auction.visibility !== AuctionVisibility.BLIND && (rankInfo !== null || totalVendors > 0);
  const showPrice  = !isSealed && auction.visibility === AuctionVisibility.PRICE;
  const showTrafficLight = !isSealed && auction.traffic_light_enabled;
  const direction  = auction.type === AuctionType.FORWARD ? 'FORWARD' : 'REVERSE';
  const canBid     = invitation?.status === InvitationStatus.ACCEPTED;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href={`/vendor/auctions/${id}`}>
          <button
            type="button"
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-full transition-colors duration-150"
          >
            <ArrowLeft size={14} />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="truncate text-base font-semibold text-text-primary tracking-tight">
              {auction.title}
            </h1>
            <AuctionStatusBadge status={auction.status} pulse />
          </div>
        </div>
      </div>

      {/* ── Pause banner ─────────────────────────────────────────────────── */}
      {isPaused && <AuctionPausedVendorBanner reason={pauseReason} />}

      {/* ── Outbid alert ─────────────────────────────────────────────────── */}
      {isOutbid && !isPaused && (
        <div className="flex items-center gap-2.5 border border-warning/30 bg-warning/8 px-4 py-3 rounded-[4px] border-l-2 border-l-warning">
          <AlertTriangle size={13} className="text-warning shrink-0" />
          <p className="text-xs font-semibold text-warning">You have been outbid — submit a new bid to stay competitive</p>
        </div>
      )}

      {/* ── Sealed bid note ──────────────────────────────────────────────── */}
      {isSealed && (
        <div className="flex items-start gap-2.5 border border-info/25 bg-info/5 px-4 py-3 rounded-[4px] border-l-2 border-l-info">
          <Info size={13} className="text-info shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Sealed bid — your offer is confidential. You may submit once.
            Results revealed when the auction closes.
          </p>
        </div>
      )}

      {/* ── Live zone: metrics left, bid input right ─────────────────────── */}
      <div className="border border-border-default bg-bg-card rounded-[4px] border-l-2 border-l-accent overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] divide-x divide-border-subtle">

          {/* Left column: metrics */}
          <div className="flex flex-col divide-y divide-border-subtle">

            {/* Time + price row */}
            <div className="grid grid-cols-2 divide-x divide-border-subtle">
              {auction.end_time && (
                <div className="px-5 py-4">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Time Left</p>
                  <AuctionTimer
                    endTime={auction.end_time}
                    onExpire={() => void load()}
                    className="font-mono text-xl font-semibold text-text-primary"
                  />
                </div>
              )}
              {showPrice && currentBest != null && (
                <div className="px-5 py-4">
                  <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Current Best</p>
                  <p className="font-mono text-xl font-semibold text-accent">{formatCurrency(currentBest)}</p>
                </div>
              )}
              {(!auction.end_time || (!showPrice || currentBest == null)) && (
                <div className="px-5 py-4 text-xs text-text-muted italic">
                  {!auction.end_time && 'No end time set'}
                </div>
              )}
            </div>

            {/* Rank + traffic light row */}
            {showRank && (
              <div className="flex items-center gap-6 px-5 py-4">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Your Rank</p>
                  <RankBadge
                    rank={rankInfo?.rank ?? null}
                    totalBidders={rankInfo?.totalActiveBidders ?? totalVendors}
                  />
                </div>
                {showTrafficLight && (
                  <TrafficLightBadge
                    status={trafficLight}
                    greenPct={auction.traffic_light_green_pct}
                    yellowPct={auction.traffic_light_yellow_pct}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right column: bid input */}
          <div className="w-80 shrink-0 px-5 py-4 flex flex-col justify-center">
            <p className="text-[9px] uppercase tracking-widest text-text-muted mb-3 font-semibold">Place Bid</p>
            {canBid ? (
              <div className={cn(isPaused && 'pointer-events-none opacity-50')}>
                <BidInput
                  currentBestAmount={showPrice ? currentBest : null}
                  minDecrement={auction.min_decrement ?? 0}
                  direction={direction}
                  onSubmit={handleBidSubmit}
                />
                {isPaused && (
                  <p className="mt-2 text-xs text-warning">Bidding is currently suspended.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Accept the invitation to enter this live bidding room.
              </p>
            )}
          </div>

        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 border px-4 py-3 rounded-[4px]',
            'shadow-[0_8px_24px_rgba(0,0,0,0.60)] animate-ticker-in',
            toast.kind === 'success' && 'border-success/30 bg-success/10 text-success',
            toast.kind === 'error'   && 'border-danger/30  bg-danger/10  text-danger',
            toast.kind === 'info'    && 'border-border-default bg-bg-elevated text-text-primary',
          )}
        >
          {toast.kind === 'success' && <CheckCircle2 size={14} className="shrink-0" />}
          {toast.kind === 'error'   && <AlertTriangle size={14} className="shrink-0" />}
          {toast.kind === 'info'    && <Info size={14} className="shrink-0" />}
          <p className="text-xs font-medium">{toast.message}</p>
        </div>
      )}

      {/* ── Access modal ─────────────────────────────────────────────────── */}
      <Modal
        open={accessModalOpen}
        onClose={() => router.replace(`/vendor/auctions/${id}`)}
        title="Accept Invitation Required"
        description="You cannot enter the bidding room until you accept this invitation."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {invitation?.status === InvitationStatus.INVITED
              ? 'Accept this auction invitation now to enter the live bidding room.'
              : 'This auction is not available for live bidding with your current invitation status.'}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.replace(`/vendor/auctions/${id}`)}>
              Back to Auction
            </Button>
            {invitation?.status === InvitationStatus.INVITED && (
              <Button
                variant="default"
                size="sm"
                loading={responding}
                onClick={() => void handleAcceptInvitation()}
              >
                Accept &amp; Enter
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
