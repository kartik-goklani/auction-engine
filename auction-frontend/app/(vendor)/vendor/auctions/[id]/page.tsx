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
import { ArrowLeft, Gavel } from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/components/ui/NotificationProvider';

export default function VendorAuctionDetailPage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();
  const { notificationVersion } = useNotifications();

  const [auction,   setAuction]   = useState<AuctionRow | null>(null);
  const [myBids,    setMyBids]    = useState<BidRowData[]>([]);
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [joinBlockedOpen, setJoinBlockedOpen] = useState(false);
  const [responding, setResponding] = useState(false);
  const [loading,   setLoading]   = useState(true);

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

    return () => {
      cancelled = true;
    };
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
      const updatedInvitation = await invitationsApi.respond(invitation.id, 'ACCEPTED');
      setInvitation(updatedInvitation);
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

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/vendor/auctions">
          <button type="button" className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-text-primary">{auction.title}</h1>
            <AuctionTypeTag type={auction.type} />
            <AuctionStatusBadge status={auction.status} pulse />
          </div>
          {auction.description && (
            <p className="mt-0.5 text-xs text-text-muted">{auction.description}</p>
          )}
        </div>
      </div>

      {/* Sealed bid notice */}
      {isSealed && !isClosed && (
        <div className="rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
          <p className="text-xs text-text-secondary">
            This is a <strong className="text-text-primary">Sealed Bid</strong> auction.
            All bids are confidential and revealed simultaneously when the auction closes.
          </p>
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: auction.type === AuctionType.FORWARD ? 'Floor Price' : 'Ceiling Price',
            value: formatCurrency(auction.ceiling_price ?? 0),
          },
          {
            label: auction.type === AuctionType.FORWARD ? 'Min Increment' : 'Min Decrement',
            value: formatCurrency(auction.min_decrement ?? 0),
          },
          { label: 'Starts',        value: auction.start_time ? formatDate(auction.start_time) : '—' },
          {
            label: isOpen ? 'Time Left' : 'Ended',
            value: isOpen && auction.end_time
              ? null
              : auction.end_time ? formatDate(auction.end_time) : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-bg-card border border-border-subtle p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
            <div className="mt-0.5">
              {label === 'Time Left' && isOpen && auction.end_time ? (
                <AuctionTimer endTime={auction.end_time} />
              ) : (
                <p className="text-xs font-medium text-text-secondary">{value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {isOpen && (
        <Button
          variant="primary"
          size="md"
          onClick={() => void handleEnterBiddingRoom()}
        >
          <Gavel size={14} />
          Enter Bidding Room
        </Button>
      )}
      {isClosed && (
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push(`/vendor/auctions/${id}/results`)}
        >
          View Results
        </Button>
      )}

      {/* My bids */}
      {myBids.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-3">My Bids</h2>
          <BidHistory bids={myBids} />
        </Card>
      )}

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
                variant="primary"
                size="sm"
                loading={responding}
                onClick={() => void handleAcceptInvitation()}
              >
                Accept Invitation
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
