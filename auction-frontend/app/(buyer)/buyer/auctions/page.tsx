'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auctionsApi } from '@/lib/api';
import type { AuctionRow } from '@/lib/types';
import { AuctionStatus } from '@/lib/types';
import { AuctionCard } from '@/components/auction/AuctionCard';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Spinner, FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Gavel, Plus } from 'lucide-react';

type TabKey = 'all' | 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';

const TABS: { id: TabKey; label: string }[] = [
  { id: 'all',       label: 'All'       },
  { id: 'draft',     label: 'Draft'     },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'live',      label: 'Live'      },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function filterByTab(auctions: AuctionRow[], tab: TabKey): AuctionRow[] {
  switch (tab) {
    case 'draft':     return auctions.filter((a) => a.status === AuctionStatus.DRAFT);
    case 'scheduled': return auctions.filter((a) => a.status === AuctionStatus.PUBLISHED);
    case 'live':      return auctions.filter((a) => a.status === AuctionStatus.OPEN);
    case 'completed': return auctions.filter(
      (a) => a.status === AuctionStatus.CLOSED || a.status === AuctionStatus.AWARDED,
    );
    case 'cancelled': return auctions.filter((a) => a.status === AuctionStatus.CANCELLED);
    default:          return auctions;
  }
}

export default function AuctionsListPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const searchQuery  = searchParams.get('q') ?? '';
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<TabKey>('all');

  const load = useCallback(() => {
    setLoading(true);
    auctionsApi
      .list()
      .then(setAuctions)
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClone(id: string) {
    await auctionsApi.clone(id);
    load();
  }

  async function handleDelete(id: string) {
    await auctionsApi.delete(id);
    load();
  }

  const tabFiltered = filterByTab(auctions, tab);
  const visible = searchQuery
    ? tabFiltered.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false),
      )
    : tabFiltered;
  const liveCount = auctions.filter((a) => a.status === AuctionStatus.OPEN).length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Auctions</h1>
          <p className="mt-1 text-sm text-text-muted">Manage all your procurement auctions</p>
        </div>
        <Link href="/buyer/auctions/new">
          <Button variant="primary" size="md">
            <Plus size={14} />
            New Auction
          </Button>
        </Link>
      </div>

      {/* Search result banner */}
      {searchQuery && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Results for <span className="text-text-primary font-medium">&ldquo;{searchQuery}&rdquo;</span> — {visible.length} found</span>
          <Link href="/buyer/auctions" className="text-accent hover:underline ml-1">Clear</Link>
        </div>
      )}

      {/* Tabs */}
      <Tabs<TabKey>
        tabs={TABS.map((t) => ({
          ...t,
          pulse: t.id === 'live' && liveCount > 0,
          badge: t.id === 'live' ? liveCount : undefined,
        }))}
        active={tab}
        onChange={setTab}
      />

      {/* Grid */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Spinner size={20} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Gavel size={20} />}
          title="No auctions here"
          description={tab === 'all' ? 'Create your first auction to get started.' : `No auctions with status "${tab}".`}
          action={
            tab === 'all' ? (
              <Link href="/buyer/auctions/new">
                <Button variant="primary" size="sm">
                  <Plus size={13} />
                  New Auction
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((auction) => (
            <div key={auction.id} className="relative group">
              <AuctionCard
                auction={auction}
                onClick={() =>
                  router.push(
                    auction.status === AuctionStatus.OPEN
                      ? `/buyer/auctions/${auction.id}/live`
                      : `/buyer/auctions/${auction.id}`,
                  )
                }
              />
              {/* Clone button on hover */}
              <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                {auction.status === AuctionStatus.DRAFT && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleDelete(auction.id); }}
                    className="flex items-center gap-1 text-[10px] text-danger bg-danger/10 border border-danger/20 rounded px-2 py-1 hover:bg-danger/20 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleClone(auction.id); }}
                  className="flex items-center gap-1 text-[10px] text-text-muted bg-bg-elevated border border-border-default rounded px-2 py-1 hover:text-text-primary transition-colors"
                >
                  Clone
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
