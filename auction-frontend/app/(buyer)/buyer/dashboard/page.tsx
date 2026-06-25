'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auctionsApi } from '@/lib/api';
import type { AuctionRow } from '@/lib/types';
import { AuctionStatus } from '@/lib/types';
import { AuctionCard } from '@/components/auction/AuctionCard';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Gavel, Plus, LayoutGrid, List } from 'lucide-react';
import { DashboardBanner } from '@/components/ui/DashboardBanner';

export default function BuyerDashboardPage() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<'card' | 'list'>('list');

  useEffect(() => {
    auctionsApi
      .list()
      .then(setAuctions)
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, []);

  const live    = auctions.filter((a) => a.status === AuctionStatus.OPEN);
  const pending = auctions.filter(
    (a) => a.status === AuctionStatus.DRAFT || a.status === AuctionStatus.PUBLISHED,
  );
  const closed  = auctions.filter(
    (a) => a.status === AuctionStatus.CLOSED || a.status === AuctionStatus.AWARDED,
  );

  if (loading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-8 w-full">

      <DashboardBanner />

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-xs text-text-muted tracking-wide">Overview of your procurement auctions</p>
        </div>
        <Link
          href="/buyer/auctions/new"
          className="inline-flex items-center gap-1.5 bg-accent text-[#0A0A0A] text-xs font-semibold px-3 py-2 rounded-full hover:bg-accent-hover transition-colors duration-150"
        >
          <Plus size={12} strokeWidth={2.5} />
          New Auction
        </Link>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Live',      value: live.length,    accent: live.length > 0 },
          { label: 'Scheduled', value: pending.length, accent: false            },
          { label: 'Completed', value: closed.length,  accent: false            },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={[
              'border border-border-subtle bg-bg-card p-5 rounded-[4px]',
              'border-l-2',
              accent ? 'border-l-success' : 'border-l-border-default',
            ].join(' ')}
          >
            <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">{label}</p>
            <p className={`mt-2 font-mono text-3xl font-semibold leading-none ${accent ? 'text-success' : 'text-text-primary'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Live now ────────────────────────────────────────────────────────── */}
      {live.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-amber-pulse" />
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-primary">Live Now</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {live.map((a) => (
              <AuctionCard
                key={a.id}
                auction={a}
                onClick={() => router.push(`/buyer/auctions/${a.id}/live`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── All auctions ────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-primary">All Auctions</h2>
          <div className="flex items-center gap-3">
            {/* View toggle */}
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
            <Link href={view === 'card' ? '/buyer/auctions?view=card' : '/buyer/auctions'} className="text-[10px] text-text-muted hover:text-accent transition-colors duration-150 uppercase tracking-wider">
              View all →
            </Link>
          </div>
        </div>

        {auctions.length === 0 ? (
          <EmptyState
            icon={<Gavel size={16} />}
            title="No auctions yet"
            description="Create your first auction to get started."
            action={
              <Link
                href="/buyer/auctions/new"
                className="inline-flex items-center gap-1.5 bg-accent text-[#0A0A0A] text-xs font-semibold px-3 py-2 rounded-full hover:bg-accent-hover transition-colors duration-150"
              >
                <Plus size={12} strokeWidth={2.5} />
                New Auction
              </Link>
            }
          />
        ) : view === 'card' ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {auctions.slice(0, 6).map((a) => (
              <AuctionCard
                key={a.id}
                auction={a}
                onClick={() => router.push(`/buyer/auctions/${a.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col border border-border-subtle rounded-[4px] overflow-hidden">
            {/* List header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-8 px-5 py-2.5 bg-bg-elevated border-b border-border-subtle">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">Auction</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-24 text-right">Ceiling</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-28 text-right">End Date</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-20 text-right">Type</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-text-muted w-20 text-right">Status</span>
            </div>
            {auctions.slice(0, 6).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => router.push(`/buyer/auctions/${a.id}`)}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-8 px-5 py-3.5 border-b border-border-subtle last:border-0 hover:bg-bg-card-hover transition-colors duration-150 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text-primary truncate">{a.title}</p>
                  {a.category && (
                    <p className="text-[10px] text-text-muted mt-0.5">{a.category}</p>
                  )}
                </div>
                <span className="font-mono text-xs font-semibold text-text-primary w-24 text-right">
                  {a.ceiling_price != null ? formatCurrency(a.ceiling_price) : '—'}
                </span>
                <span className="font-mono text-[11px] text-text-secondary w-28 text-right">
                  {a.end_time ? formatDate(a.end_time) : '—'}
                </span>
                <div className="w-20 flex justify-end">
                  <AuctionTypeTag type={a.type} />
                </div>
                <div className="w-20 flex justify-end">
                  <AuctionStatusBadge status={a.status} size="sm" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
