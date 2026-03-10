'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { invitationsApi, auctionsApi } from '@/lib/api';
import type { AuctionRow, InvitationRow } from '@/lib/types';
import { AuctionStatus, InvitationStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Gavel, Calendar, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNotifications } from '@/components/ui/NotificationProvider';

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

export default function VendorAuctionsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const searchQuery  = searchParams.get('q') ?? '';
  const { notificationVersion } = useNotifications();
  const [items,   setItems]   = useState<AuctionWithInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<FilterTab>('all');

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

    return () => {
      cancelled = true;
    };
  }, [notificationVersion]);

  const allFiltered = items.filter(({ auction, invitation }) => {
    if (tab === 'all') return true;
    if (tab === 'pending')  return invitation.status === InvitationStatus.INVITED;
    if (tab === 'accepted') return invitation.status === InvitationStatus.ACCEPTED;
    if (tab === 'closed')   return auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.AWARDED;
    return true;
  });

  const filtered = searchQuery
    ? allFiltered.filter(({ auction }) =>
        auction.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (auction.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
      )
    : allFiltered;

  if (loading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">My Auctions</h1>
        <p className="mt-1 text-sm text-text-muted">{items.length} auction invitation{items.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-subtle">
        {TABS.map(({ id, label }) => {
          const count = items.filter(({ auction, invitation }) => {
            if (id === 'all')      return true;
            if (id === 'pending')  return invitation.status === InvitationStatus.INVITED;
            if (id === 'accepted') return invitation.status === InvitationStatus.ACCEPTED;
            if (id === 'closed')   return auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.AWARDED;
            return true;
          }).length;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'px-3 py-2 text-xs font-medium transition-colors duration-150 border-b-2 -mb-px',
                tab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              ].join(' ')}
            >
              {label}
              {count > 0 && (
                <span className={[
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  tab === id ? 'bg-accent/15 text-accent' : 'bg-bg-tag text-text-muted',
                ].join(' ')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Auction list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Gavel size={20} />}
          title="No auctions here"
          description={tab === 'all' ? 'You have no auction invitations yet.' : `No ${tab} auctions.`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map(({ auction, invitation }) => (
            <button
              key={invitation.id}
              type="button"
              onClick={() => router.push(`/vendor/auctions/${auction.id}`)}
              className="text-left rounded-[16px] bg-bg-card border border-border-subtle p-4 flex flex-col gap-3 hover:border-accent/30 hover:shadow-[0_0_14px_rgba(168,85,247,0.10)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Gavel size={14} className="text-text-muted shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-text-primary truncate">{auction.title}</p>
                </div>
                <ChevronRight size={14} className="text-text-muted shrink-0" />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                <AuctionStatusBadge status={auction.status} />
                <AuctionTypeTag type={auction.type} />
                {invitation.status === InvitationStatus.INVITED && (
                  <Badge variant="warning" size="sm">Pending Response</Badge>
                )}
                {invitation.status === InvitationStatus.ACCEPTED && (
                  <Badge variant="success" size="sm">Accepted</Badge>
                )}
                {invitation.status === InvitationStatus.DECLINED && (
                  <Badge variant="default" size="sm">Declined</Badge>
                )}
              </div>

              {/* Dates */}
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <Calendar size={10} />
                <span>Invited {formatDate(invitation.invited_at)}</span>
                {auction.end_time && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>Ends {formatDate(auction.end_time)}</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
