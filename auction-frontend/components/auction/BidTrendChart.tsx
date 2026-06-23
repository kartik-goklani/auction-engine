'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Cell,
} from 'recharts';
import type { BidRow, AuctionAlertRow } from '@/lib/types';
import { AuctionType, AlertSeverity } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useBidChartData } from '@/hooks/useBidChartData';
import type { TrafficLightConfig } from '@/hooks/useBidChartData';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BidTrendChartProps {
  bids:               BidRow[];
  auctionType:        AuctionType;
  ceilingPrice:       number;
  isLive:             boolean;
  trafficLightConfig?: TrafficLightConfig;
  marketBenchmark?:   { recommendedUnitPrice: number; confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' };
  anomalyAlerts?:     AuctionAlertRow[];
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type LiveTab    = 'bids' | 'best' | 'spread' | 'savings' | 'rank' | 'velocity' | 'traffic';
type ResultsTab = 'bids' | 'best' | 'spread' | 'savings' | 'rank' | 'award' | 'improvement' | 'benchmark' | 'scatter';

const LIVE_TABS: { id: LiveTab; label: string }[] = [
  { id: 'bids',     label: 'All Bids'       },
  { id: 'best',     label: 'Best Price'     },
  { id: 'spread',   label: 'Spread'         },
  { id: 'savings',  label: 'Savings Tracker'},
  { id: 'rank',     label: 'Rank Timeline'  },
  { id: 'velocity', label: 'Bid Velocity'   },
  { id: 'traffic',  label: 'Traffic Light'  },
];

const RESULTS_TABS: { id: ResultsTab; label: string }[] = [
  { id: 'bids',        label: 'All Bids'         },
  { id: 'best',        label: 'Best Price'        },
  { id: 'spread',      label: 'Spread'            },
  { id: 'savings',     label: 'Savings Tracker'   },
  { id: 'rank',        label: 'Rank Timeline'     },
  { id: 'award',       label: 'Award Gap'         },
  { id: 'improvement', label: 'Bid Improvement'   },
  { id: 'benchmark',   label: 'Price vs Benchmark'},
  { id: 'scatter',     label: 'Bid Count vs Drop' },
];

const TAB_DESCRIPTIONS: Record<string, string> = {
  bids:        'Every accepted bid plotted in order — each color is a different vendor.',
  best:        "Each vendor's running best bid over time.",
  spread:      "Each vendor's bid trajectory — the gap between lines shows competitive spread.",
  savings:     'Savings vs opening ceiling price, updated with each bid.',
  rank:        'Leaderboard position over time — rank 1 is the current leader.',
  velocity:    'Bid volume by vendor per 30-second window.',
  traffic:     'Current competitive status of each vendor relative to best price.',
  award:       'Final best bid per vendor — the gap shows how competitive the auction was.',
  improvement: 'How far each vendor moved from their opening bid.',
  benchmark:   'Winning price trajectory vs AI market benchmark and opening ceiling.',
  scatter:     'Bid volume vs price concession — reveals each vendor\'s bidding strategy.',
};

// ─── Severity dot color ────────────────────────────────────────────────────────

function alertDotColor(severity: AlertSeverity): string {
  if (severity === AlertSeverity.HIGH)   return '#ef4444';
  if (severity === AlertSeverity.MEDIUM) return '#f97316';
  return '#eab308';
}

function dotRadius(severity: AlertSeverity): number {
  if (severity === AlertSeverity.HIGH)   return 7;
  if (severity === AlertSeverity.MEDIUM) return 5;
  return 4;
}

// ─── Sanitise a vendor key into a valid SVG gradient ID ───────────────────────

function toGradId(key: string): string {
  return `grad-${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function fmtAmount(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  if (rupees >= 1_000)    return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${rupees}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function fmtRank(v: number): string {
  return `#${v}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name:  string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?:   boolean;
  payload?:  TooltipPayloadItem[];
  label?:    number | string;
  isCount?:  boolean;
  isPct?:    boolean;
  isRank?:   boolean;
}

function CustomTooltip({ active, payload, label, isCount, isPct, isRank }: CustomTooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  const timeLabel = typeof label === 'number' ? fmtTime(label) : String(label);
  return (
    <div className="rounded-[10px] bg-bg-card border border-border-subtle shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-3 min-w-[148px]">
      <p className="text-[10px] text-text-muted mb-2 font-mono">{timeLabel}</p>
      {payload.map((entry) => (
        <div key={`${entry.name}-${entry.value}`} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] text-text-secondary">{entry.name}</span>
          </div>
          <span className="text-[11px] font-semibold text-text-primary font-mono">
            {isCount
              ? `${entry.value} bid${entry.value !== 1 ? 's' : ''}`
              : isPct
                ? fmtPct(entry.value)
                : isRank
                  ? fmtRank(entry.value)
                  : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CurrencyTooltip(props: CustomTooltipProps) { return <CustomTooltip {...props} isCount={false} isPct={false} isRank={false} />; }
function CountTooltip(props: CustomTooltipProps)    { return <CustomTooltip {...props} isCount />; }
function PctTooltip(props: CustomTooltipProps)      { return <CustomTooltip {...props} isPct />; }
function RankTooltip(props: CustomTooltipProps)     { return <CustomTooltip {...props} isRank />; }

// ─── Tab button helpers ────────────────────────────────────────────────────────

function TabButton({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      key={id}
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-[4px] text-[11px] font-medium transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-accent/10 text-accent border border-accent/25'
          : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated/60 border border-transparent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyChart() {
  return (
    <div className="h-[264px] flex items-center justify-center">
      <p className="text-xs text-text-muted">No accepted bids yet</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BidTrendChart({
  bids,
  auctionType,
  ceilingPrice,
  isLive,
  trafficLightConfig,
  marketBenchmark,
  anomalyAlerts = [],
}: BidTrendChartProps) {
  const [liveTab,      setLiveTab]      = useState<LiveTab>('bids');
  const [resultsTab,   setResultsTab]   = useState<ResultsTab>('bids');
  const [showAlerts,   setShowAlerts]   = useState(false);
  const [hoveredAlert, setHoveredAlert] = useState<AuctionAlertRow | null>(null);
  const [tooltipPos,   setTooltipPos]   = useState<{ x: number; y: number } | null>(null);
  const [hiddenVendors, setHiddenVendors] = useState<Set<string>>(new Set());
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  const {
    vendorLines,
    vendorColors,
    allBidsData,
    bestPriceData,
    spreadData,
    savingsData,
    rankTimelineData,
    bidVelocityData,
    trafficLightData,
    awardGapData,
    bidImprovementData,
    bidCountVsPriceDropData,
    vendorCount,
  } = useBidChartData(bids, auctionType, ceilingPrice, trafficLightConfig);

  const tab = isLive ? liveTab : resultsTab;

  // Reset legend filter when the active tab changes — every tab starts clean
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiddenVendors(new Set());
  }, [tab]);

  function toggleVendor(key: string): void {
    setHiddenVendors(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const acceptedCount = useMemo(
    () => bids.filter((b) => b.status === 'ACCEPTED').length,
    [bids],
  );

  const isEmpty = acceptedCount === 0;

  // Final savings badge value (last data point)
  const finalSavingsPct = savingsData.length > 0 ? savingsData[savingsData.length - 1]!.savingsPct : null;

  // ── Anomaly dots: resolve bid position for each alert ────────────────────────
  const anomalyDots = useMemo(() => {
    if (isLive || !showAlerts || anomalyAlerts.length === 0) return [];
    const acceptedBids = bids.filter((b) => b.status === 'ACCEPTED');

    return anomalyAlerts.map((alert) => {
      let ts: number | null = null;
      let amount: number | null = null;

      if (alert.bid_id) {
        const matchingBid = acceptedBids.find((b) => b.id === alert.bid_id);
        if (matchingBid) {
          ts     = new Date(matchingBid.submitted_at).getTime();
          amount = matchingBid.amount;
        }
      }

      // Fallback: nearest bid to alert's created_at
      if (ts == null && acceptedBids.length > 0) {
        const alertTs  = new Date(alert.created_at).getTime();
        const nearest  = acceptedBids.reduce((prev, curr) => {
          const prevDiff = Math.abs(new Date(prev.submitted_at).getTime() - alertTs);
          const currDiff = Math.abs(new Date(curr.submitted_at).getTime() - alertTs);
          return currDiff < prevDiff ? curr : prev;
        });
        ts     = new Date(nearest.submitted_at).getTime();
        amount = nearest.amount;
      }

      return { alert, ts, amount };
    }).filter((d): d is { alert: AuctionAlertRow; ts: number; amount: number } =>
      d.ts != null && d.amount != null,
    );
  }, [isLive, showAlerts, anomalyAlerts, bids]);

  const axisStyle  = { fontSize: 10, fill: '#71717a' };
  const gridStroke = '#27272a';

  // ── Gradient defs for area charts (one per vendor) ───────────────────────────
  function renderGradientDefs() {
    return (
      <defs>
        {vendorLines.map(({ key, color }) => (
          <linearGradient key={toGradId(key)} id={toGradId(key)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        ))}
      </defs>
    );
  }

  // ── Render helper: vendor lines (rank timeline) ───────────────────────────────
  function renderVendorLines() {
    return vendorLines.map(({ key, color }) => (
      <Line
        key={key}
        type="monotone"
        dataKey={key}
        stroke={color}
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4, strokeWidth: 0 }}
        connectNulls
        hide={hiddenVendors.has(key)}
      />
    ));
  }

  // ── Render helper: vendor areas (line charts with gradient fill) ──────────────
  function renderVendorAreas() {
    return vendorLines.map(({ key, color }) => (
      <Area
        key={key}
        type="monotone"
        dataKey={key}
        stroke={color}
        strokeWidth={2}
        fill={`url(#${toGradId(key)})`}
        dot={false}
        activeDot={{ r: 4, strokeWidth: 0 }}
        connectNulls
        hide={hiddenVendors.has(key)}
      />
    ));
  }

  function renderVendorBars(stackId?: string) {
    return vendorLines.map(({ key, color }) => (
      <Bar
        key={key}
        dataKey={key}
        stackId={stackId}
        fill={color}
        maxBarSize={48}
        radius={[2, 2, 0, 0]}
        hide={hiddenVendors.has(key)}
      />
    ));
  }

  // ── Chart rendering ───────────────────────────────────────────────────────────

  function renderChart() {
    if (isEmpty) return <EmptyChart />;

    // ── TRAFFIC LIGHT (stat cards, not a chart) ──────────────────────────────
    if (tab === 'traffic') {
      if (!trafficLightConfig?.enabled) {
        return (
          <div className="h-[264px] flex items-center justify-center">
            <div className="rounded-[4px] border border-border-subtle bg-bg-elevated px-5 py-4 text-center">
              <p className="text-xs text-text-muted">Traffic lights not enabled for this auction</p>
            </div>
          </div>
        );
      }
      const cards = [
        { status: 'GREEN',  color: '#22c55e', label: 'Competitive',    count: trafficLightData.GREEN  },
        { status: 'YELLOW', color: '#eab308', label: 'Approaching gap', count: trafficLightData.YELLOW },
        { status: 'RED',    color: '#ef4444', label: 'Off pace',        count: trafficLightData.RED    },
      ] as const;
      return (
        <div className="h-[264px] flex items-center justify-center gap-5">
          {cards.map(({ status, color, label, count }) => (
            <div
              key={status}
              className="flex flex-col items-center gap-3 rounded-lg px-8 py-6 min-w-[120px]"
              style={{
                background: `linear-gradient(145deg, ${color}0a, transparent)`,
                border: `1px solid ${color}30`,
              }}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 12px ${color}88`,
                }}
              />
              <p className="text-3xl font-bold font-mono" style={{ color }}>{count}</p>
              <p className="text-[11px] text-text-muted text-center leading-tight">{label}</p>
            </div>
          ))}
        </div>
      );
    }

    // ── PRICE VS BENCHMARK ────────────────────────────────────────────────────
    if (tab === 'benchmark') {
      if (!marketBenchmark) {
        return (
          <div className="h-[264px] flex items-center justify-center">
            <p className="text-xs text-text-muted">Price intelligence data not available for this auction.</p>
          </div>
        );
      }
      const isReverse    = auctionType !== AuctionType.FORWARD;
      const marketBestData = bestPriceData.map((pt) => {
        const { ts, ...rest } = pt as Record<string, number>;
        const values = Object.values(rest).filter((v) => typeof v === 'number' && !isNaN(v)) as number[];
        if (values.length === 0) return null;
        const best = isReverse ? Math.min(...values) : Math.max(...values);
        return { ts, 'Market Best': best };
      }).filter(Boolean) as { ts: number; 'Market Best': number }[];

      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={marketBestData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad-benchmark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="ts" tickFormatter={fmtTime} tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtAmount} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<CurrencyTooltip />} />
              <ReferenceLine y={marketBenchmark.recommendedUnitPrice} stroke="#eab308" strokeDasharray="4 2" label={{ value: 'AI Benchmark', fill: '#eab308', fontSize: 10 }} />
              <ReferenceLine y={ceilingPrice}                         stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Ceiling',       fill: '#ef4444', fontSize: 10 }} />
              <Area type="monotone" dataKey="Market Best" stroke="#22c55e" strokeWidth={2} fill="url(#grad-benchmark)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── AWARD GAP (horizontal bar chart) ──────────────────────────────────────
    if (tab === 'award') {
      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={awardGapData} layout="vertical" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid horizontal={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={fmtAmount} tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="vendor" tick={axisStyle} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar dataKey="finalBid" maxBarSize={24} radius={[0, 2, 2, 0]}>
                {awardGapData.map((entry, idx) => (
                  <Cell key={entry.vendor} fill={idx === 0 ? '#22c55e' : '#52525b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── BID IMPROVEMENT (grouped bars) ────────────────────────────────────────
    if (tab === 'improvement') {
      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bidImprovementData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="vendor" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtAmount} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar dataKey="firstBid" name="First Bid" fill="#52525b" maxBarSize={24} radius={[2, 2, 0, 0]} />
              <Bar dataKey="lastBid"  name="Final Bid" maxBarSize={24} radius={[2, 2, 0, 0]}>
                {bidImprovementData.map(({ vendor }) => (
                  <Cell key={vendor} fill={vendorColors[vendor] ?? '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── BID COUNT VS DROP (scatter chart) ────────────────────────────────────
    if (tab === 'scatter') {
      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="bidCount"
                type="number"
                name="Bids Placed"
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Bids Placed', fill: '#71717a', fontSize: 10, position: 'insideBottom', offset: -12 }}
                allowDecimals={false}
              />
              <YAxis
                dataKey="priceDrop"
                type="number"
                name="Price Drop %"
                tickFormatter={fmtPct}
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as { vendor: string; bidCount: number; priceDrop: number } | undefined;
                  if (!d) return null;
                  return (
                    <div className="rounded-[10px] bg-bg-card border border-border-subtle shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-3">
                      <p className="text-[11px] font-semibold text-text-primary">{d.vendor}</p>
                      <p className="text-[10px] text-text-muted">{d.bidCount} bids · {fmtPct(d.priceDrop)} drop</p>
                    </div>
                  );
                }}
              />
              {bidCountVsPriceDropData.map((entry) => {
                const color  = vendorColors[entry.vendor] ?? '#22c55e';
                const letter = entry.vendor.replace('Bidder ', '');
                return (
                  <Scatter
                    key={entry.vendor}
                    name={entry.vendor}
                    data={[{ bidCount: entry.bidCount, priceDrop: entry.priceDrop }]}
                    fill={color}
                    shape={(props: { cx?: number; cy?: number }) => {
                      const cx = props.cx ?? 0;
                      const cy = props.cy ?? 0;
                      return (
                        <g>
                          <circle cx={cx} cy={cy} r={14} fill={color} opacity={0.15} />
                          <circle cx={cx} cy={cy} r={10} fill={color} opacity={0.9}  />
                          <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}>{letter}</text>
                        </g>
                      );
                    }}
                  />
                );
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── BID VELOCITY (stacked bar, 30-second buckets) ─────────────────────────
    if (tab === 'velocity') {
      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bidVelocityData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CountTooltip />} />
              {renderVendorBars('velocity')}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── SAVINGS TRACKER ───────────────────────────────────────────────────────
    if (tab === 'savings') {
      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={savingsData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad-savings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="ts" tickFormatter={fmtTime} tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtPct} tick={axisStyle} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<PctTooltip />} />
              <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 2" label={{ value: '0%', fill: '#52525b', fontSize: 10 }} />
              <Area type="monotone" dataKey="savingsPct" name="Savings" stroke="#10b981" strokeWidth={2} fill="url(#grad-savings)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── RANK TIMELINE ─────────────────────────────────────────────────────────
    if (tab === 'rank') {
      return (
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rankTimelineData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="ts" tickFormatter={fmtTime} tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis
                reversed
                domain={[1, vendorCount]}
                allowDecimals={false}
                tickFormatter={fmtRank}
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<RankTooltip />} />
              {renderVendorLines()}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // ── ALL BIDS, BEST PRICE, SPREAD (AreaCharts with gradient fill) ──────────
    const data =
      tab === 'bids'   ? allBidsData   :
      tab === 'best'   ? bestPriceData :
      spreadData;

    return (
      <div ref={chartWrapperRef} className="relative">
        <div className="h-[264px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              {renderGradientDefs()}
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="ts" tickFormatter={fmtTime} tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtAmount} tick={axisStyle} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<CurrencyTooltip />} />
              {renderVendorAreas()}
              {/* Anomaly overlay — results page All Bids tab only */}
              {tab === 'bids' && showAlerts && anomalyDots.map(({ alert, ts, amount }) => (
                <ReferenceDot
                  key={alert.id}
                  x={ts}
                  y={amount}
                  r={dotRadius(alert.severity)}
                  fill={alertDotColor(alert.severity)}
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(_data, event) => {
                    const svgEl      = (event as React.MouseEvent<SVGCircleElement>).currentTarget;
                    const rect       = svgEl.getBoundingClientRect();
                    const wrapperRect = chartWrapperRef.current?.getBoundingClientRect();
                    if (!wrapperRect) return;
                    setHoveredAlert(alert);
                    setTooltipPos({
                      x: rect.left + rect.width  / 2 - wrapperRect.left,
                      y: rect.top               - wrapperRect.top - 8,
                    });
                  }}
                  onMouseLeave={() => { setHoveredAlert(null); setTooltipPos(null); }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Floating hover tooltip */}
        {hoveredAlert && tooltipPos && (
          <div
            className="pointer-events-none absolute z-50 w-64 rounded-[4px] border border-border-default bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-3"
            style={{
              left:      tooltipPos.x,
              top:       tooltipPos.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: alertDotColor(hoveredAlert.severity) }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: alertDotColor(hoveredAlert.severity) }}
              >
                {hoveredAlert.severity}
              </span>
              <span className="ml-auto text-[10px] text-text-muted font-mono">
                {hoveredAlert.alert_type.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">{hoveredAlert.description}</p>
            {hoveredAlert.vendor_ids_involved && hoveredAlert.vendor_ids_involved.length > 0 && (
              <p className="mt-1.5 text-[10px] text-text-muted">
                {hoveredAlert.vendor_ids_involved.length} vendor{hoveredAlert.vendor_ids_involved.length !== 1 ? 's' : ''} involved
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Legend ────────────────────────────────────────────────────────────────────

  function renderLegend() {
    if (isEmpty) return null;
    if (tab === 'traffic' || tab === 'savings') return null;
    if (tab === 'velocity') {
      return (
        <div className="flex items-center gap-4 flex-wrap">
          {vendorLines.map(({ key, color }) => (
            <div
              key={key}
              onClick={() => toggleVendor(key)}
              className={`flex items-center gap-1.5 cursor-pointer select-none transition-opacity ${
                hiddenVendors.has(key) ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-text-muted">{key}</span>
            </div>
          ))}
        </div>
      );
    }
    if (tab === 'award') {
      return (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-[#22c55e]" />
            <span className="text-[10px] text-text-muted">Winner</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-[#52525b]" />
            <span className="text-[10px] text-text-muted">Other</span>
          </div>
        </div>
      );
    }
    if (tab === 'improvement') {
      return (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#52525b]" />
            <span className="text-[10px] text-text-muted">First Bid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />
            <span className="text-[10px] text-text-muted">Final Bid</span>
          </div>
        </div>
      );
    }
    if (tab === 'benchmark' || tab === 'scatter') return null;
    return (
      <div className="flex items-center gap-4 flex-wrap">
        {vendorLines.map(({ key, color }) => (
          <div
            key={key}
            onClick={() => toggleVendor(key)}
            className={`flex items-center gap-1.5 cursor-pointer select-none transition-opacity ${
              hiddenVendors.has(key) ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <span className="h-[2px] w-5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-text-muted">{key}</span>
          </div>
        ))}
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  const tabs      = isLive ? LIVE_TABS    : RESULTS_TABS;
  const activeTab = isLive ? liveTab      : resultsTab;
  const setTab    = isLive
    ? (id: string) => setLiveTab(id as LiveTab)
    : (id: string) => setResultsTab(id as ResultsTab);

  return (
    <div className="flex flex-col gap-2">
      {/* Tab bar + stats */}
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-0.5 flex-wrap">
          {tabs.map(({ id, label }) => (
            <TabButton
              key={id}
              id={id}
              label={label}
              active={activeTab === id}
              onClick={() => setTab(id)}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isLive && finalSavingsPct != null && finalSavingsPct > 0 && (
            <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-medium">
              Saved {fmtPct(finalSavingsPct)}
            </span>
          )}
          <span className="text-[10px] text-text-muted">{acceptedCount} accepted bids</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[10px] text-text-muted leading-relaxed">{TAB_DESCRIPTIONS[tab]}</p>

      {/* Chart */}
      {renderChart()}

      {/* Anomaly overlay toggle + severity legend — results All Bids tab only */}
      {!isLive && tab === 'bids' && anomalyAlerts.length > 0 && !isEmpty && (
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-border-subtle accent-accent"
              checked={showAlerts}
              onChange={(e) => { setShowAlerts(e.target.checked); setHoveredAlert(null); setTooltipPos(null); }}
            />
            <span className="text-[10px] text-text-muted">Show anomaly flags ({anomalyAlerts.length})</span>
          </label>

          {showAlerts && anomalyDots.length > 0 && (
            <div className="flex items-center gap-3">
              {(
                [
                  { severity: AlertSeverity.HIGH,   label: 'High'   },
                  { severity: AlertSeverity.MEDIUM, label: 'Medium' },
                  { severity: AlertSeverity.LOW,    label: 'Low'    },
                ] as const
              )
                .filter(({ severity }) => anomalyDots.some((d) => d.alert.severity === severity))
                .map(({ severity, label }) => {
                  const r = dotRadius(severity);
                  return (
                    <div key={severity} className="flex items-center gap-1.5">
                      <span
                        className="rounded-full inline-block shrink-0"
                        style={{ width: r * 2, height: r * 2, backgroundColor: alertDotColor(severity) }}
                      />
                      <span className="text-[10px] text-text-muted">{label}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {renderLegend()}
    </div>
  );
}
