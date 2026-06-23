'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { auctionsApi, auditApi } from '@/lib/api';
import type { AuditLogRow } from '@/lib/types';
import type { AuctionRow } from '@/lib/types';
import { ActorType } from '@/lib/types';
import { Table, type Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDatePrecise } from '@/lib/utils';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';


// Use AuditLogRow from lib/types directly

const ACTOR_VARIANT: Record<ActorType, 'accent' | 'info' | 'elevated' | 'default'> = {
  [ActorType.BUYER]:  'accent',
  [ActorType.VENDOR]: 'info',
  [ActorType.SYSTEM]: 'elevated',
  [ActorType.AGENT]:  'default',
};

export default function AuditTrailPage() {
  const { id } = useParams<{ id: string }>();

  const [auction, setAuction]   = useState<AuctionRow | null>(null);
  const [entries, setEntries]   = useState<AuditLogRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actorFilter, setActorFilter] = useState<ActorType | 'all'>('all');

  const load = useCallback(async () => {
    const [a, logs] = await Promise.all([
      auctionsApi.get(id),
      auditApi.list(id),
    ]);
    setAuction(a);
    setEntries(logs);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const filtered = actorFilter === 'all'
    ? entries
    : entries.filter((e) => e.actor_type === actorFilter);

  const columns: Column<AuditLogRow>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      cell: (row) => (
        <span className="font-mono text-[11px] text-text-muted">{formatDatePrecise(row.created_at)}</span>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      cell: (row) => (
        <span className="text-xs font-medium text-text-primary">{row.action}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      cell: (row) => (
        <Badge variant={ACTOR_VARIANT[row.actor_type ?? ActorType.SYSTEM]} size="sm">
          {row.actor_type ?? 'SYSTEM'}
        </Badge>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="text-xs text-text-secondary">{String(row.metadata?.description ?? row.action)}</span>
      ),
      className: 'max-w-xs',
    },
  ];

  const [exporting, setExporting] = useState(false);

  if (loading || !auction) return <FullPageSpinner />;

  async function handleExport() {
    setExporting(true);
    try {
      await auditApi.exportCsv(id);
    } catch {
      // silently fail — browser will show no download
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/buyer/auctions/${id}`}>
            <button type="button" className="p-1.5 rounded-[3px] text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
              <ArrowLeft size={14} />
            </button>
          </Link>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-text-primary">Audit Trail</h1>
            <p className="text-xs text-text-muted mt-0.5">{auction.title}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" loading={exporting} onClick={() => { void handleExport(); }}>
          <Download size={13} />
          Export CSV
        </Button>
      </div>

      {/* Actor filter chips */}
      <div className="flex items-center gap-2">
        {(['all', ActorType.BUYER, ActorType.VENDOR, ActorType.SYSTEM] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActorFilter(f)}
            className={`px-2.5 py-1 rounded-[3px] text-[10px] font-medium uppercase tracking-wide transition-colors ${
              actorFilter === f
                ? 'bg-bg-elevated text-text-primary border border-border-default'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <span className="text-[10px] text-text-muted ml-2">{filtered.length} entries</span>
      </div>

      <Table<AuditLogRow>
        columns={columns}
        data={filtered}
        keyExtractor={(row) => row.id}
        emptyMessage="No audit events recorded."
      />
    </div>
  );
}
