'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  connectSocket, joinAuction, leaveAuction,
  onBidAccepted, onBidRejected, onBidConfirmed,
  onAuctionExtended, onAuctionClosed, onYourRank, onOutbid,
} from '@/lib/socket';
import { auctionsApi, bidsApi, invitationsApi } from '@/lib/api';
import { getAccessToken } from '@/lib/supabase';
import type { AuctionRow, InvitationRow, YourRankPayload } from '@/lib/types';
import { AuctionType, AuctionVisibility, InvitationStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { BidInput } from '@/components/bid/BidInput';
import { RankBadge } from '@/components/bid/RankBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const [outbid,       setOutbid]       = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [responding,   setResponding]   = useState(false);
  const [loading,      setLoading]      = useState(true);

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

  // Resolve current vendor id from Supabase token claims
  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setVendorId(payload.sub as string);
      } catch { /* ignore */ }
    });
  }, []);

  // Socket lifecycle
  useEffect(() => {
    if (!vendorId || invitation?.status !== InvitationStatus.ACCEPTED) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void connectSocket().then(() => {
      if (cancelled) return;

      joinAuction(id, vendorId);

      const offBidAccepted = onBidAccepted((p) => {
        setCurrentBest(p.currentBestAmount ?? null);
        setOutbid(false);
      });
      const offBidRejected = onBidRejected((p) => {
        showToast(`Bid rejected: ${p.reason}`, 'error');
      });
      const offBidConfirmed = onBidConfirmed((p) => {
        showToast(`Bid ${formatCurrency(p.amount)} confirmed!`, 'success');
      });
      const offYourRank = onYourRank((p) => {
        setRankInfo(p);
        setTotalVendors(p.totalActiveBidders);
      });
      const offOutbid = onOutbid((p) => {
        setOutbid(true);
        setCurrentBest(p.currentBestAmount);
        showToast(`You were outbid! New best: ${formatCurrency(p.currentBestAmount)}`, 'info');
      });
      const offExtended = onAuctionExtended((p) => {
        setAuction((prev) => prev ? { ...prev, end_time: p.newEndTime } : prev);
        showToast(`Auction extended by ${p.extensionMinutes} minutes`, 'info');
      });
      const offClosed = onAuctionClosed(() => {
        showToast('Auction closed! Redirecting to results…', 'info');
        setTimeout(() => router.push(`/vendor/auctions/${id}/results`), 3000);
      });

      cleanup = () => {
        offBidAccepted();
        offBidRejected();
        offBidConfirmed();
        offYourRank();
        offOutbid();
        offExtended();
        offClosed();
        leaveAuction(id);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id, invitation?.status, router, vendorId]);

  async function handleAcceptInvitation() {
    if (!invitation) return;

    setResponding(true);
    try {
      const updatedInvitation = await invitationsApi.respond(invitation.id, 'ACCEPTED');
      setInvitation(updatedInvitation);
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
  const direction  = auction.type === AuctionType.FORWARD ? 'FORWARD' : 'REVERSE';
  const canJoinAuction = invitation?.status === InvitationStatus.ACCEPTED;

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/vendor/auctions/${id}`}>
          <button type="button" className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="truncate text-lg font-bold text-text-primary">{auction.title}</h1>
            <AuctionStatusBadge status={auction.status} pulse />
          </div>
        </div>
      </div>

      {/* Outbid banner */}
      {outbid && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertCircle size={14} className="text-warning shrink-0" />
          <p className="text-xs font-medium text-warning">You have been outbid!</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.50)] transition-all duration-300',
            toast.kind === 'success' && 'border-success/30 bg-success/10 text-success',
            toast.kind === 'error'   && 'border-danger/30  bg-danger/10  text-danger',
            toast.kind === 'info'    && 'border-border-default bg-bg-elevated text-text-primary',
          )}
        >
          {toast.kind === 'success' && <CheckCircle2 size={14} className="shrink-0" />}
          {toast.kind === 'error'   && <AlertCircle  size={14} className="shrink-0" />}
          <p className="text-xs font-medium">{toast.message}</p>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3">
        {auction.end_time && (
          <Card className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Time Left</p>
            <AuctionTimer
              endTime={auction.end_time}
              onExpire={() => void load()}
              className="text-lg"
            />
          </Card>
        )}
        {showPrice && currentBest != null && (
          <Card className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Current Best</p>
            <p className="font-mono text-lg font-bold text-success">{formatCurrency(currentBest)}</p>
          </Card>
        )}
      </div>

      {/* Rank badge */}
      {showRank && (
        <Card className="flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Your Rank</p>
            <RankBadge
              rank={rankInfo?.rank ?? null}
              totalBidders={rankInfo?.totalActiveBidders ?? totalVendors}
            />
          </div>
        </Card>
      )}

      {/* Sealed bid note */}
      {isSealed && (
        <div className="rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
          <p className="text-xs text-text-secondary">
            Sealed bid: your offer is confidential. You may submit once. Results revealed on close.
          </p>
        </div>
      )}

      {/* Bid input */}
      <Card>
        <h2 className="text-sm font-semibold text-text-primary mb-4">Place Your Bid</h2>
        {canJoinAuction ? (
          <BidInput
            currentBestAmount={showPrice ? currentBest : null}
            minDecrement={auction.min_decrement ?? 0}
            direction={direction}
            onSubmit={handleBidSubmit}
          />
        ) : (
          <p className="text-sm text-text-secondary">
            Accept the invitation to join this live bidding room.
          </p>
        )}
      </Card>

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
                variant="primary"
                size="sm"
                loading={responding}
                onClick={() => void handleAcceptInvitation()}
              >
                Accept Invitation
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
