'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invitationsApi, auctionsApi } from '@/lib/api';
import type { InvitationRow, AuctionRow } from '@/lib/types';
import { InvitationStatus, AuctionStatus } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Gavel, Clock, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNotifications } from '@/components/ui/NotificationProvider';

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
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
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

  const pending = invitations.filter((i) => i.status === InvitationStatus.INVITED);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Vendor Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Your auction invitations and active bids</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Invitations', value: pending.length,       color: 'text-warning'      },
          { label: 'Accepted',            value: invitations.filter((i) => i.status === InvitationStatus.ACCEPTED).length, color: 'text-success' },
          { label: 'Total',               value: invitations.length,   color: 'text-text-primary' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-[10px] bg-bg-card border border-border-subtle p-5 shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
          >
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
            <p className={`mt-1 font-mono text-3xl font-bold leading-none ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pending invitations — quick Accept / Decline */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Pending Invitations
            <Badge variant="warning" size="sm" className="ml-2">{pending.length}</Badge>
          </h2>
          <div className="flex flex-col gap-2">
            {pending.map((inv) => {
              const auction = auctionMap.get(inv.auction_id);
              return (
                <Card key={inv.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Gavel size={15} className="shrink-0 text-text-muted" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {auction?.title ?? 'Auction Invitation'}
                      </p>
                      <p className="text-[10px] text-text-muted flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(inv.invited_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={responding === inv.id}
                      onClick={() => respond(inv.id, 'DECLINED')}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={responding === inv.id}
                      onClick={() => respond(inv.id, 'ACCEPTED')}
                    >
                      Accept
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* All auctions — full invitation list with status */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">My Auctions</h2>
        {invitations.length === 0 ? (
          <EmptyState
            icon={<Gavel size={20} />}
            title="No auction invitations"
            description="You haven't been invited to any auctions yet."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {invitations.map((inv) => {
              const auction = auctionMap.get(inv.auction_id);
              return (
                <Card
                  key={inv.id}
                  interactive
                  onClick={() => router.push(`/vendor/auctions/${inv.auction_id}`)}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Gavel size={15} className="text-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {auction?.title ?? 'Loading…'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {auction && <AuctionStatusBadge status={auction.status} />}
                        <p className="text-[10px] text-text-muted">{formatDate(inv.invited_at)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {inv.status === InvitationStatus.INVITED && (
                      <Badge variant="warning" size="sm">Pending Response</Badge>
                    )}
                    {inv.status === InvitationStatus.ACCEPTED && (
                      <Badge variant="success" size="sm">Accepted</Badge>
                    )}
                    {inv.status === InvitationStatus.DECLINED && (
                      <Badge variant="default" size="sm">Declined</Badge>
                    )}
                    <ChevronRight size={14} className="text-text-muted" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
