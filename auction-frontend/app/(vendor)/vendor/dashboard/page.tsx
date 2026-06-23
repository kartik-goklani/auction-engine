'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invitationsApi, auctionsApi } from '@/lib/api';
import type { InvitationRow, AuctionRow } from '@/lib/types';
import { AuctionStatus, InvitationStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Gavel, ChevronRight, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNotifications } from '@/components/ui/NotificationProvider';
import { cn } from '@/lib/utils';

export default function VendorDashboardPage() {
  const router = useRouter();
  const { notificationVersion } = useNotifications();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [auctionMap,  setAuctionMap]  = useState<Map<string, AuctionRow>>(new Map());
  const [loading,     setLoading]     = useState(true);
  const [responding,  setResponding]  = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    invitationsApi
      .mine()
      .then(async (invs) => {
        if (cancelled) return;
        setInvitations(invs);
        const uniqueIds = [...new Set(invs.map((i) => i.auction_id))];
        const auctions = await Promise.all(uniqueIds.map((id) => auctionsApi.get(id)));
        if (cancelled) return;
        setAuctionMap(new Map(auctions.map((a) => [a.id, a])));
      })
      .catch(() => {
        if (!cancelled) {
          setInvitations([]);
          setAuctionMap(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [notificationVersion]);

  async function respond(invId: string, action: 'ACCEPTED' | 'DECLINED') {
    setResponding(invId);
    try {
      await invitationsApi.respond(invId, action);
      setInvitations((prev) =>
        prev.map((i) =>
          i.id === invId
            ? { ...i, status: action === 'ACCEPTED' ? InvitationStatus.ACCEPTED : InvitationStatus.DECLINED }
            : i,
        ),
      );
    } finally {
      setResponding(null);
    }
  }

  const pending  = invitations.filter((i) => i.status === InvitationStatus.INVITED);
  const accepted = invitations.filter((i) => i.status === InvitationStatus.ACCEPTED);
  const live     = accepted.filter((i) => {
    const a = auctionMap.get(i.auction_id);
    return a?.status === AuctionStatus.OPEN;
  });

  if (loading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-8">

      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          {invitations.length === 0
            ? 'No auction invitations yet'
            : `${invitations.length} invitation${invitations.length !== 1 ? 's' : ''} across all auctions`}
        </p>
      </div>

      {/* Stats — 3 signal cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Pending',
            value: pending.length,
            accent: pending.length > 0 ? 'warning' as const : null,
            sub: pending.length > 0 ? 'Need your response' : 'Nothing to review',
          },
          {
            label: 'Live Now',
            value: live.length,
            accent: live.length > 0 ? 'success' as const : null,
            sub: live.length > 0 ? 'Active bidding open' : 'No auctions live',
          },
          {
            label: 'Accepted',
            value: accepted.length,
            accent: null,
            sub: 'Total accepted invitations',
          },
        ].map(({ label, value, accent, sub }) => (
          <div
            key={label}
            className={cn(
              'border border-border-subtle bg-bg-card p-4 rounded-[4px] border-l-2',
              accent === 'warning' ? 'border-l-warning' :
              accent === 'success' ? 'border-l-success' :
              'border-l-border-default',
            )}
          >
            <p className="text-[9px] uppercase tracking-widest text-text-muted font-semibold">{label}</p>
            <p className={cn(
              'mt-2 font-mono text-3xl font-semibold leading-none',
              accent === 'warning' ? 'text-warning' :
              accent === 'success' ? 'text-success' :
              'text-text-primary',
            )}>
              {value}
            </p>
            <p className="mt-1.5 text-[9px] text-text-muted leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      {/* All invitations — single consolidated list */}
      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          My Auctions
        </h2>

        {invitations.length === 0 ? (
          <EmptyState
            icon={<Gavel size={16} />}
            title="No auction invitations"
            description="A buyer will invite you once an auction is ready."
          />
        ) : (
          <div className="flex flex-col gap-px border border-border-subtle rounded-[4px] overflow-hidden">
            {invitations.map((inv, idx) => {
              const auction = auctionMap.get(inv.auction_id);
              const isPending = inv.status === InvitationStatus.INVITED;
              const isLive    = auction?.status === AuctionStatus.OPEN;

              return (
                <div
                  key={inv.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 bg-bg-card border-l-2 transition-colors duration-150',
                    isPending      ? 'border-l-warning'       :
                    isLive         ? 'border-l-success'        :
                    'border-l-transparent',
                    !isPending && 'cursor-pointer hover:bg-bg-card-hover',
                    idx !== 0 && 'border-t border-border-subtle',
                  )}
                  onClick={!isPending ? () => router.push(`/vendor/auctions/${inv.auction_id}`) : undefined}
                  role={!isPending ? 'button' : undefined}
                  tabIndex={!isPending ? 0 : undefined}
                  onKeyDown={!isPending ? (e) => { if (e.key === 'Enter') router.push(`/vendor/auctions/${inv.auction_id}`); } : undefined}
                >
                  {/* Icon */}
                  <div className={cn(
                    'shrink-0 flex h-7 w-7 items-center justify-center rounded-[3px] border',
                    isLive    ? 'border-success/25 bg-success/8  text-success' :
                    isPending ? 'border-warning/25 bg-warning/8  text-warning' :
                    'border-border-subtle bg-bg-elevated text-text-muted',
                  )}>
                    <Gavel size={12} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {auction?.title ?? 'Loading…'}
                      </p>
                      {auction && <AuctionStatusBadge status={auction.status} pulse={isLive} />}
                      {auction && <AuctionTypeTag type={auction.type} />}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                      <Clock size={9} />
                      Invited {formatDate(inv.invited_at)}
                    </p>
                  </div>

                  {/* Right: actions or status + chevron */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isPending ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={responding === inv.id}
                          onClick={(e) => { e.stopPropagation(); void respond(inv.id, 'DECLINED'); }}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          loading={responding === inv.id}
                          onClick={(e) => { e.stopPropagation(); void respond(inv.id, 'ACCEPTED'); }}
                        >
                          Accept
                        </Button>
                      </>
                    ) : (
                      <>
                        {inv.status === InvitationStatus.ACCEPTED && (
                          <Badge variant="success" size="sm">Accepted</Badge>
                        )}
                        {inv.status === InvitationStatus.DECLINED && (
                          <Badge variant="default" size="sm">Declined</Badge>
                        )}
                        <ChevronRight size={13} className="text-text-muted" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
