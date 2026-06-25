'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auctionsApi } from '@/lib/api';
import type { AuctionRow } from '@/lib/types';
import { AuctionStatus } from '@/lib/types';
import { AuctionCard } from '@/components/auction/AuctionCard';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Spinner, FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Gavel, Plus, LayoutGrid, List } from 'lucide-react';

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

function buildUrl(view: 'card' | 'list', q: string): string {
  const params = new URLSearchParams();
  if (view !== 'list') params.set('view', view);
  if (q) params.set('q', q);
  const qs = params.toString();
  return `/buyer/auctions${qs ? `?${qs}` : ''}`;
}

function AuctionsListPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const searchQuery  = searchParams.get('q') ?? '';
  const viewParam    = searchParams.get('view') === 'card' ? 'card' : 'list';

  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<TabKey>('all');
  const [view,     setView]     = useState<'card' | 'list'>(viewParam);

  // Keep state in sync with URL (e.g. browser back/forward)
  useEffect(() => {
    setView(searchParams.get('view') === 'card' ? 'card' : 'list');
  }, [searchParams]);

  const load = useCallback(() => {
    setLoading(true);
    auctionsApi
      .list()
      .then(setAuctions)
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function handleViewChange(next: 'card' | 'list') {
    setView(next);
    router.replace(buildUrl(next, searchQuery), { scroll: false });
  }

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

  const ViewToggle = (
    <div className="flex items-center border border-border-subtle rounded-[4px] overflow-hidden">
      <button
        type="button"
        onClick={() => handleViewChange('card')}
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
        onClick={() => handleViewChange('list')}
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
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Auctions</h1>
          <p className="mt-0.5 text-xs text-text-muted">Manage all your procurement auctions</p>
        </div>
        <div className="flex items-center gap-3">
          {ViewToggle}
          <Link href="/buyer/auctions/new">
            <Button variant="default" size="md">
              <Plus size={12} strokeWidth={2.5} />
              New Auction
            </Button>
          </Link>
        </div>
      </div>

      {/* Search result banner */}
      {searchQuery && (
        <div className="flex items-center gap-2 text-xs text-text-muted border border-border-subtle bg-bg-elevated px-3 py-2 rounded-[4px]">
          <span>Results for <span className="text-text-primary font-medium">&ldquo;{searchQuery}&rdquo;</span> — {visible.length} found</span>
          <Link href={buildUrl(view, '')} className="text-accent hover:underline ml-1 text-[11px]">Clear ×</Link>
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

      {/* Content */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Spinner size={18} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Gavel size={16} />}
          title="No auctions here"
          description={tab === 'all' ? 'Create your first auction to get started.' : `No auctions with status "${tab}".`}
          action={
            tab === 'all' ? (
              <Link href="/buyer/auctions/new">
                <Button variant="default" size="sm">
                  <Plus size={12} strokeWidth={2.5} />
                  New Auction
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
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
              <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                {auction.status === AuctionStatus.DRAFT && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleDelete(auction.id); }}
                    className="text-[9px] font-medium uppercase tracking-wider text-danger bg-danger/10 border border-danger/20 rounded-full px-2 py-1 hover:bg-danger/20 transition-colors duration-150"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleClone(auction.id); }}
                  className="text-[9px] font-medium uppercase tracking-wider text-text-muted bg-bg-elevated border border-border-default rounded-full px-2 py-1 hover:text-text-primary transition-colors duration-150"
                >
                  Clone
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col border border-border-subtle rounded-[4px] overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-8 px-5 py-2.5 bg-bg-elevated border-b border-border-subtle">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">Auction</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-24 text-right">Ceiling</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-28 text-right">End Date</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-20 text-right">Type</span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-20 text-right">Status</span>
            <span className="w-20" />
          </div>
          {visible.map((auction) => (
            <div
              key={auction.id}
              className="group grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-8 px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-card transition-colors duration-150"
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    auction.status === AuctionStatus.OPEN
                      ? `/buyer/auctions/${auction.id}/live`
                      : `/buyer/auctions/${auction.id}`,
                  )
                }
                className="min-w-0 text-left"
              >
                <p className="text-[13px] font-medium text-text-primary truncate">{auction.title}</p>
                {auction.category && (
                  <p className="text-[10px] text-text-muted mt-0.5">{auction.category}</p>
                )}
              </button>
              <span className="font-mono text-xs font-semibold text-text-primary w-24 text-right">
                {auction.ceiling_price != null ? formatCurrency(auction.ceiling_price) : '—'}
              </span>
              <span className="font-mono text-[11px] text-text-secondary w-28 text-right">
                {auction.end_time ? formatDate(auction.end_time) : '—'}
              </span>
              <div className="w-20 flex justify-end">
                <AuctionTypeTag type={auction.type} />
              </div>
              <div className="w-20 flex justify-end">
                <AuctionStatusBadge status={auction.status} size="sm" />
              </div>
              <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {auction.status === AuctionStatus.DRAFT && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(auction.id)}
                    className="text-[9px] font-medium uppercase tracking-wider text-danger bg-danger/10 border border-danger/20 rounded-full px-2 py-0.5 hover:bg-danger/20 transition-colors duration-150"
                  >
                    Del
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleClone(auction.id)}
                  className="text-[9px] font-medium uppercase tracking-wider text-text-muted bg-bg-elevated border border-border-default rounded-full px-2 py-0.5 hover:text-text-primary transition-colors duration-150"
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

export default function AuctionsPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <AuctionsListPage />
    </Suspense>
  );
}
