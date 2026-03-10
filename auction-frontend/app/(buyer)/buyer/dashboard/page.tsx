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

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">Overview of your procurement auctions</p>
        </div>
        <Link href="/buyer/auctions/new">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-accent-hover active:scale-[0.97] transition-all duration-150 shadow-[0_4px_14px_rgba(168,85,247,0.40)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.55)]"
          >
            <Plus size={14} />
            New Auction
          </button>
        </Link>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Live Auctions',     value: live.length,    color: 'text-success'      },
          { label: 'Scheduled / Draft', value: pending.length, color: 'text-warning'      },
          { label: 'Completed',         value: closed.length,  color: 'text-text-primary' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-[20px] bg-bg-card border border-border-subtle p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_0_20px_rgba(168,85,247,0.10)] hover:-translate-y-0.5 transition-all duration-200"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
            <p className={`mt-2 font-mono text-3xl font-bold leading-none ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Live now ─────────────────────────────────────────────────────── */}
      {live.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">Live Now</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
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

      {/* ── All auctions ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">All Auctions</h2>
          <Link href="/buyer/auctions" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>

        {auctions.length === 0 ? (
          <EmptyState
            icon={<Gavel size={20} />}
            title="No auctions yet"
            description="Create your first auction to get started."
            action={
              <Link href="/buyer/auctions/new">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-accent-hover active:scale-[0.97] transition-all duration-150 shadow-[0_4px_14px_rgba(168,85,247,0.40)]"
                >
                  <Plus size={13} />
                  New Auction
                </button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-4">
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
