'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auctionsApi } from '@/lib/api';
import type { AuctionRow } from '@/lib/types';
import { AuctionStatus } from '@/lib/types';
import { AuctionCard } from '@/components/auction/AuctionCard';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Gavel, Plus } from 'lucide-react';

export default function BuyerDashboardPage() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading,  setLoading]  = useState(true);

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

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-xs text-text-muted tracking-wide">Overview of your procurement auctions</p>
        </div>
        <Link
          href="/buyer/auctions/new"
          className="inline-flex items-center gap-1.5 bg-accent text-[#0A0A0A] text-xs font-semibold px-3 py-2 rounded-[4px] hover:bg-accent-hover transition-colors duration-150"
        >
          <Plus size={12} strokeWidth={2.5} />
          New Auction
        </Link>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Live',         value: live.length,    accent: live.length > 0 },
          { label: 'Scheduled',    value: pending.length, accent: false            },
          { label: 'Completed',    value: closed.length,  accent: false            },
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
          <Link href="/buyer/auctions" className="text-[10px] text-text-muted hover:text-accent transition-colors duration-150 uppercase tracking-wider">
            View all →
          </Link>
        </div>

        {auctions.length === 0 ? (
          <EmptyState
            icon={<Gavel size={16} />}
            title="No auctions yet"
            description="Create your first auction to get started."
            action={
              <Link
                href="/buyer/auctions/new"
                className="inline-flex items-center gap-1.5 bg-accent text-[#0A0A0A] text-xs font-semibold px-3 py-2 rounded-[4px] hover:bg-accent-hover transition-colors duration-150"
              >
                <Plus size={12} strokeWidth={2.5} />
                New Auction
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {auctions.slice(0, 6).map((a) => (
              <AuctionCard
                key={a.id}
                auction={a}
                onClick={() => router.push(`/buyer/auctions/${a.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
