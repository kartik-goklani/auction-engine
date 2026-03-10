'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { BidRow } from '@/lib/types';
import { BidStatus, AuctionType } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const VENDOR_COLORS = ['#a855f7', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];
const VENDOR_LABELS = 'ABCDEFGHIJ'.split('');

type Tab = 'bids' | 'best' | 'spread' | 'activity';

const TABS: { id: Tab; label: string }[] = [
  { id: 'bids',     label: 'All Bids'    },
  { id: 'best',     label: 'Best Price'  },
  { id: 'spread',   label: 'Spread'      },
  { id: 'activity', label: 'Activity'    },
];

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  bids:     'Every accepted bid plotted in order — each color is a different vendor.',
  best:     "Each vendor's running best bid over time.",
  spread:   "Each vendor's best bid trajectory — the gap between lines shows the competitive spread.",
  activity: 'Bid volume by vendor per 5-minute window.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtAmount(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  if (rupees >= 1_000)    return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${rupees}`;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name:  string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?:  boolean;
  payload?: TooltipPayloadItem[];
  label?:   number;
  /** When true, values are rendered as integer counts, not currency amounts. */
  isCount?: boolean;
}

function CustomTooltip({ active, payload, label, isCount }: CustomTooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="rounded-[10px] bg-bg-card border border-border-subtle shadow-[0_4px_16px_rgba(0,0,0,0.4)] p-3 min-w-[130px]">
      <p className="text-[10px] text-text-muted mb-2">{fmtTime(label)}</p>
      {payload.map((entry) => (
        <div key={`${entry.name}-${entry.value}`} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] text-text-secondary">{entry.name}</span>
          </div>
          <span className="text-[11px] font-semibold text-text-primary font-mono">
            {isCount
              ? `${entry.value} bid${entry.value !== 1 ? 's' : ''}`
              : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Wrapper components so the isCount prop can be passed through Recharts' content prop
// without Recharts overwriting it with its own injected props.
function CurrencyTooltip(props: CustomTooltipProps) {
  return <CustomTooltip {...props} isCount={false} />;
}

function CountTooltip(props: CustomTooltipProps) {
  return <CustomTooltip {...props} isCount />;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BidTrendChartProps {
  bids:        BidRow[];
  auctionType: AuctionType;
}

export function BidTrendChart({ bids, auctionType }: BidTrendChartProps) {
  const [tab, setTab] = useState<Tab>('bids');

  const accepted = useMemo(
    () => bids.filter((b) => b.status === BidStatus.ACCEPTED).sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    ),
    [bids],
  );

  // Build vendor index map internally from first-appearance order in accepted bids.
  // Not accepting it as a prop prevents stale-ref issues: when bids refetch mid-auction
  // and a new vendor ID appears, the external map (built only at load time) falls back
  // to ?? 0 for every unknown vendor — producing duplicate "Bidder A" React keys.
  // A useMemo derived from the same `accepted` array is always consistent.
  const vendorIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    accepted.forEach((b) => {
      if (!map.has(b.vendor_id)) map.set(b.vendor_id, map.size);
    });
    return map;
  }, [accepted]);

  const vendorIds = useMemo(
    () => [...new Set(accepted.map((b) => b.vendor_id))],
    [accepted],
  );

  // ── All Bids: one point per accepted bid ───────────────────────────────────
  const allBidsData = useMemo(() => {
    return accepted.map((b) => {
      const idx   = vendorIndexMap.get(b.vendor_id) ?? 0;
      const label = `Bidder ${VENDOR_LABELS[idx] ?? idx}`;
      return {
        ts:      new Date(b.submitted_at).getTime(),
        [label]: b.amount,
      };
    });
  }, [accepted, vendorIndexMap]);

  // ── Best Price: running best per vendor over time ──────────────────────────
  const bestPriceData = useMemo(() => {
    const isReverse = auctionType !== AuctionType.FORWARD;
    const runningBest: Record<string, number> = {};
    return accepted.map((b) => {
      const idx      = vendorIndexMap.get(b.vendor_id) ?? 0;
      const label    = `Bidder ${VENDOR_LABELS[idx] ?? idx}`;
      const prev     = runningBest[label];
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) runningBest[label] = b.amount;
      return { ts: new Date(b.submitted_at).getTime(), ...runningBest };
    });
  }, [accepted, vendorIndexMap, auctionType]);

  // ── Spread: per-vendor running best as separate lines.
  //    The visual gap between vendor trajectories IS the spread — more useful
  //    than a single max-min scalar because the buyer sees which vendor is at
  //    each end and how they converge or diverge over time.
  const spreadData = useMemo(() => {
    if (accepted.length === 0) return [];
    const isReverse = auctionType !== AuctionType.FORWARD;
    const runningBest: Record<string, number> = {};
    return accepted.map((b) => {
      const idx      = vendorIndexMap.get(b.vendor_id) ?? 0;
      const label    = `Bidder ${VENDOR_LABELS[idx] ?? idx}`;
      const prev     = runningBest[label];
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) runningBest[label] = b.amount;
      return { ts: new Date(b.submitted_at).getTime(), ...runningBest };
    });
  }, [accepted, vendorIndexMap, auctionType]);

  // ── Activity: per-vendor bid counts per 5-min bucket (stacked bars).
  //    Each bucket shows both total volume AND which vendor contributed what,
  //    so the buyer can spot late-rush patterns or dominant bidders at a glance.
  const activityData = useMemo(() => {
    if (accepted.length === 0) return [];
    const BUCKET_MS = 5 * 60 * 1_000;
    const buckets = new Map<number, Record<string, number>>();
    accepted.forEach((b) => {
      const t      = new Date(b.submitted_at).getTime();
      const bucket = Math.floor(t / BUCKET_MS) * BUCKET_MS;
      const idx    = vendorIndexMap.get(b.vendor_id) ?? 0;
      const label  = `Bidder ${VENDOR_LABELS[idx] ?? idx}`;
      const row    = buckets.get(bucket) ?? {};
      row[label]   = (row[label] ?? 0) + 1;
      buckets.set(bucket, row);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, counts]) => ({ ts, ...counts }));
  }, [accepted, vendorIndexMap]);

  const vendorLines = useMemo(() =>
    vendorIds.map((vid) => {
      const idx = vendorIndexMap.get(vid) ?? 0;
      return {
        key:   `Bidder ${VENDOR_LABELS[idx] ?? idx}`,
        color: VENDOR_COLORS[idx % VENDOR_COLORS.length] as string,
      };
    }),
    [vendorIds, vendorIndexMap],
  );

  const isEmpty    = accepted.length === 0;
  const axisStyle  = { fontSize: 10, fill: '#71717a' };
  const gridStroke = '#27272a';

  return (
    <div className="flex flex-col gap-2">
      {/* Tab bar */}
      <div className="flex items-center gap-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150',
              tab === id
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-text-muted">{accepted.length} accepted bids</span>
      </div>

      {/* Contextual description — changes with the active tab */}
      <p className="text-[10px] text-text-muted leading-relaxed">{TAB_DESCRIPTIONS[tab]}</p>

      {/* Chart */}
      {isEmpty ? (
        <div className="h-[220px] flex items-center justify-center">
          <p className="text-xs text-text-muted">No accepted bids yet</p>
        </div>
      ) : (
        <div className="h-[220px]">
          {tab === 'activity' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<CountTooltip />} />
                {vendorLines.map(({ key, color }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="activity"
                    fill={color}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={tab === 'bids' ? allBidsData : tab === 'best' ? bestPriceData : spreadData}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtAmount} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<CurrencyTooltip />} />
                {vendorLines.map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Legend for line charts */}
      {!isEmpty && tab !== 'activity' && (
        <div className="flex items-center gap-4 flex-wrap">
          {vendorLines.map(({ key, color }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="h-[2px] w-5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-text-muted">{key}</span>
            </div>
          ))}
        </div>
      )}

      {/* Legend for activity stacked bar chart */}
      {!isEmpty && tab === 'activity' && (
        <div className="flex items-center gap-4 flex-wrap">
          {vendorLines.map(({ key, color }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-text-muted">{key}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
