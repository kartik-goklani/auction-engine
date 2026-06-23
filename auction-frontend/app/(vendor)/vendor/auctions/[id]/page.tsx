'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auctionsApi, bidsApi, invitationsApi } from '@/lib/api';
import type { AuctionRow, BidRow as BidRowData, InvitationRow } from '@/lib/types';
import { AuctionStatus, AuctionType, InvitationStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { BidHistory } from '@/components/bid/BidHistory';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Gavel, Lock, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/components/ui/NotificationProvider';

export default function VendorAuctionDetailPage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();
  const { notificationVersion } = useNotifications();

  const [auction,    setAuction]    = useState<AuctionRow | null>(null);
  const [myBids,     setMyBids]     = useState<BidRowData[]>([]);
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [joinBlockedOpen, setJoinBlockedOpen] = useState(false);
  const [responding,      setResponding]      = useState(false);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      auctionsApi.get(id),
      bidsApi.mine(id),
      invitationsApi.mine(),
    ])
      .then(([a, b, invitations]) => {
        if (cancelled) return;
        setAuction(a);
        setMyBids(b);
        setInvitation(invitations.find((item) => item.auction_id === id) ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, notificationVersion]);

  async function handleEnterBiddingRoom() {
    if (invitation?.status === InvitationStatus.ACCEPTED) {
      router.push(`/vendor/auctions/${id}/bid`);
      return;
    }
    setJoinBlockedOpen(true);
  }

  async function handleAcceptInvitation() {
    if (!invitation) return;
    setResponding(true);
    try {
      const updated = await invitationsApi.respond(invitation.id, 'ACCEPTED');
      setInvitation(updated);
      setJoinBlockedOpen(false);
      router.push(`/vendor/auctions/${id}/bid`);
    } finally {
      setResponding(false);
    }
  }

  if (loading || !auction) return <FullPageSpinner />;

  const isOpen   = auction.status === AuctionStatus.OPEN;
  const isClosed = auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.AWARDED;
  const isSealed = auction.type === AuctionType.SEALED_BID;
  const isForward = auction.type === AuctionType.FORWARD;

  const priceLabel    = isForward ? 'Floor Price'   : 'Ceiling Price';
  const stepLabel     = isForward ? 'Min Increment' : 'Min Decrement';

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/vendor/auctions">
          <button
            type="button"
            className="mt-0.5 p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-[3px] transition-colors duration-150"
          >
            <ArrowLeft size={14} />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary tracking-tight">{auction.title}</h1>
            <AuctionTypeTag type={auction.type} />
            <AuctionStatusBadge status={auction.status} pulse={isOpen} />
          </div>
          {auction.description && (
            <p className="mt-1 text-xs text-text-muted leading-relaxed">{auction.description}</p>
          )}
        </div>
      </div>

      {/* Sealed bid notice */}
      {isSealed && !isClosed && (
        <div className="flex items-start gap-3 border border-info/25 bg-info/5 px-4 py-3 rounded-[4px] border-l-2 border-l-info">
          <Lock size={13} className="text-info shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-primary">Sealed Bid</span> — your offer is confidential.
            All bids are revealed simultaneously when the auction closes.
          </p>
        </div>
      )}

      {/* Detail grid — 4 cells: price, step, start, end */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-border-subtle bg-bg-card p-4 rounded-[4px] border-l-2 border-l-accent">
          <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">{priceLabel}</p>
          <p className="font-mono text-base font-semibold text-accent">
            {formatCurrency(auction.ceiling_price ?? 0)}
          </p>
        </div>
        <div className="border border-border-subtle bg-bg-card p-4 rounded-[4px]">
          <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">{stepLabel}</p>
          <p className="font-mono text-base font-semibold text-text-primary">
            {formatCurrency(auction.min_decrement ?? 0)}
          </p>
        </div>
        <div className="border border-border-subtle bg-bg-card p-4 rounded-[4px]">
          <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Opens</p>
          <p className="font-mono text-xs text-text-secondary">
            {auction.start_time ? formatDate(auction.start_time) : '—'}
          </p>
        </div>
        <div className="border border-border-subtle bg-bg-card p-4 rounded-[4px]">
          <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">
            {isOpen ? 'Time Left' : 'Closed'}
          </p>
          {isOpen && auction.end_time ? (
            <AuctionTimer endTime={auction.end_time} className="font-mono text-xs" />
          ) : (
            <p className="font-mono text-xs text-text-secondary">
              {auction.end_time ? formatDate(auction.end_time) : '—'}
            </p>
          )}
        </div>
      </div>

      {/* Primary CTA */}
      {isOpen && (
        <div className="border border-success/25 bg-success/5 rounded-[4px] border-l-2 border-l-success p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">Bidding is live</p>
            <p className="text-xs text-text-muted mt-0.5">
              {invitation?.status === InvitationStatus.ACCEPTED
                ? 'You are accepted — enter the bidding room to compete.'
                : 'Accept this invitation to enter the live bidding room.'}
            </p>
          </div>
          <Button
            variant="default"
            size="md"
            onClick={() => void handleEnterBiddingRoom()}
            className="shrink-0"
          >
            <Gavel size={13} />
            Enter Bidding Room
          </Button>
        </div>
      )}

      {isClosed && (
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push(`/vendor/auctions/${id}/results`)}
        >
          <BarChart2 size={13} />
          View Results
        </Button>
      )}

      {/* My bids */}
      {myBids.length > 0 && (
        <Card padding="sm">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3 px-1">
            My Bids
          </h2>
          <BidHistory bids={myBids} />
        </Card>
      )}

      {/* Accept invitation modal */}
      <Modal
        open={joinBlockedOpen}
        onClose={() => setJoinBlockedOpen(false)}
        title="Accept Invitation Required"
        description="You cannot join the bidding room until you accept this invitation."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {invitation?.status === InvitationStatus.INVITED
              ? 'Accept this auction invitation now to enter the live bidding room.'
              : 'This auction is not available for live bidding with your current invitation status.'}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setJoinBlockedOpen(false)}>
              Cancel
            </Button>
            {invitation?.status === InvitationStatus.INVITED ? (
              <Button
                variant="default"
                size="sm"
                loading={responding}
                onClick={() => void handleAcceptInvitation()}
              >
                Accept &amp; Enter
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setJoinBlockedOpen(false)}>
                Close
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
