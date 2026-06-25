'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { invitationsApi, auctionsApi } from '@/lib/api';
import type { AuctionRow, InvitationRow } from '@/lib/types';
import { AuctionStatus, InvitationStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Gavel, Calendar, ChevronRight, Zap, LayoutGrid, List } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNotifications } from '@/components/ui/NotificationProvider';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'pending' | 'accepted' | 'closed';

interface AuctionWithInvitation {
  auction: AuctionRow;
  invitation: InvitationRow;
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'All'      },
  { id: 'pending',  label: 'Pending'  },
  { id: 'accepted', label: 'Accepted' },
  { id: 'closed',   label: 'Closed'   },
];

function VendorAuctionsContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const searchQuery  = searchParams.get('q') ?? '';
  const { notificationVersion } = useNotifications();
  const [items,   setItems]   = useState<AuctionWithInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<FilterTab>('all');
  const [view,    setView]    = useState<'card' | 'list'>('list');

  useEffect(() => {
    let cancelled = false;

    invitationsApi
      .mine()
      .then(async (invitations) => {
        if (cancelled) return;
        const uniqueAuctionIds = [...new Set(invitations.map((i) => i.auction_id))];
        const auctions = await Promise.all(uniqueAuctionIds.map((id) => auctionsApi.get(id)));
        if (cancelled) return;
        const auctionMap = new Map(auctions.map((a) => [a.id, a]));
        const result: AuctionWithInvitation[] = invitations
          .map((inv) => {
            const auction = auctionMap.get(inv.auction_id);
            if (!auction) return null;
            return { auction, invitation: inv };
          })
          .filter((x): x is AuctionWithInvitation => x !== null);
        setItems(result);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [notificationVersion]);

  const filterFn = (id: FilterTab) => ({ auction, invitation }: AuctionWithInvitation) => {
    if (id === 'all')      return true;
    if (id === 'pending')  return invitation.status === InvitationStatus.INVITED;
    if (id === 'accepted') return invitation.status === InvitationStatus.ACCEPTED;
    if (id === 'closed')   return auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.AWARDED;
    return true;
  };

  const allFiltered = items.filter(filterFn(tab));
  const filtered = searchQuery
    ? allFiltered.filter(({ auction }) =>
        auction.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (auction.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
      )
    : allFiltered;

  const liveCount = items.filter(({ auction, invitation }) =>
    auction.status === AuctionStatus.OPEN && invitation.status === InvitationStatus.ACCEPTED,
  ).length;

  const ViewToggle = (
    <div className="flex items-center border border-border-subtle rounded-[4px] overflow-hidden">
      <button
        type="button"
        onClick={() => setView('card')}
        className={`flex items-center justify-center p-1.5 transition-colors duration-150 ${
          view === 'card'
            ? 'bg-bg-elevated text-text-primary'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="Card view"
      >
        <LayoutGrid size={13} />
      </button>
      <button
        type="button"
        onClick={() => setView('list')}
        className={`flex items-center justify-center p-1.5 transition-colors duration-150 border-l border-border-subtle ${
          view === 'list'
            ? 'bg-bg-elevated text-text-primary'
            : 'text-text-muted hover:text-text-secondary'
        }`}
        title="List view"
      >
        <List size={13} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-text-primary">My Auctions</h1>
          <p className="mt-0.5 text-xs text-text-muted">
            {items.length} invitation{items.length !== 1 ? 's' : ''}
            {searchQuery && ` · filtered by "${searchQuery}"`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ViewToggle}
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-success/8 border border-success/25 rounded-[4px]">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-amber-pulse" />
              <span className="text-[10px] font-semibold text-success uppercase tracking-wider">
                {liveCount} Live
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs<FilterTab>
        tabs={TABS.map(({ id, label }) => {
          const count = items.filter(filterFn(id)).length;
          return { id, label, badge: count > 0 ? count : undefined };
        })}
        active={tab}
        onChange={setTab}
      />

      {/* Content */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Spinner size={18} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Gavel size={20} />}
          title="No auctions here"
          description={tab === 'all' ? 'You have no auction invitations yet.' : `No ${tab} auctions.`}
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(({ auction, invitation }) => {
            const isPending = invitation.status === InvitationStatus.INVITED;
            const isLive    = auction.status === AuctionStatus.OPEN;
            const isClosed  = auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.AWARDED;

            return (
              <button
                key={invitation.id}
                type="button"
                onClick={() => router.push(`/vendor/auctions/${auction.id}`)}
                className={cn(
                  'text-left rounded-[4px] bg-bg-card border border-border-subtle border-l-2 p-4 flex flex-col gap-3',
                  'hover:bg-bg-card-hover transition-colors duration-150 cursor-pointer',
                  isPending ? 'border-l-warning' :
                  isLive    ? 'border-l-success'  :
                  isClosed  ? 'border-l-border-default' :
                  'border-l-accent',
                )}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className={cn(
                      'mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-[3px] border',
                      isLive    ? 'border-success/25 bg-success/8 text-success' :
                      isPending ? 'border-warning/25 bg-warning/8 text-warning' :
                      'border-border-subtle bg-bg-elevated text-text-muted',
                    )}>
                      {isLive ? <Zap size={11} /> : <Gavel size={11} />}
                    </div>
                    <p className="text-sm font-semibold text-text-primary leading-tight">{auction.title}</p>
                  </div>
                  <ChevronRight size={13} className="text-text-muted shrink-0 mt-0.5" />
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <AuctionStatusBadge status={auction.status} pulse={isLive} />
                  <AuctionTypeTag type={auction.type} />
                  {isPending && <Badge variant="warning" size="sm">Awaiting Response</Badge>}
                  {invitation.status === InvitationStatus.DECLINED && (
                    <Badge variant="default" size="sm">Declined</Badge>
                  )}
                </div>

                {/* Dates */}
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                  <Calendar size={9} />
                  <span>Invited {formatDate(invitation.invited_at)}</span>
                  {auction.end_time && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>Ends {formatDate(auction.end_time)}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col border border-border-subtle rounded-[4px] overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-8 px-5 py-2.5 bg-bg-elevated border-b border-border-subtle">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">Auction</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-28 text-right">Invited</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-28 text-right">End Date</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-20 text-right">Type</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-24 text-right">Status</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-24 text-right">Invitation</span>
          </div>

          {filtered.map(({ auction, invitation }) => {
            const isPending = invitation.status === InvitationStatus.INVITED;
            const isLive    = auction.status === AuctionStatus.OPEN;

            return (
              <button
                key={invitation.id}
                type="button"
                onClick={() => router.push(`/vendor/auctions/${auction.id}`)}
                className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-8 px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-card transition-colors duration-150 w-full text-left"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text-primary truncate">{auction.title}</p>
                  {auction.category && (
                    <p className="text-[10px] text-text-muted mt-0.5">{auction.category}</p>
                  )}
                </div>
                <span className="font-mono text-[11px] text-text-secondary w-28 text-right">
                  {formatDate(invitation.invited_at)}
                </span>
                <span className="font-mono text-[11px] text-text-secondary w-28 text-right">
                  {auction.end_time ? formatDate(auction.end_time) : '—'}
                </span>
                <div className="w-20 flex justify-end">
                  <AuctionTypeTag type={auction.type} />
                </div>
                <div className="w-24 flex justify-end">
                  <AuctionStatusBadge status={auction.status} pulse={isLive} size="sm" />
                </div>
                <div className="w-24 flex justify-end">
                  {isPending ? (
                    <Badge variant="warning" size="sm">Pending</Badge>
                  ) : invitation.status === InvitationStatus.ACCEPTED ? (
                    <Badge variant="success" size="sm">Accepted</Badge>
                  ) : invitation.status === InvitationStatus.DECLINED ? (
                    <Badge variant="default" size="sm">Declined</Badge>
                  ) : (
                    <span className="text-[10px] text-text-muted">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function VendorAuctionsPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <VendorAuctionsContent />
    </Suspense>
  );
}
