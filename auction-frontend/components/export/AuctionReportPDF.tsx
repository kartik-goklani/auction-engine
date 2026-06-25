import React from 'react';
import {
  Document, Page, Text, View, StyleSheet,
  Svg, Line as SvgLine, Path,
} from '@react-pdf/renderer';
import type {
  AuctionRow, BidRow, VendorRow,
  AwardRecommendationRow, AuctionAlertRow, AuctionAiMetadata,
} from '@/lib/types';
import { AuctionType, BidStatus } from '@/lib/types';

// ─── Public data type ─────────────────────────────────────────────────────────

export interface AuctionReportData {
  auction:        AuctionRow;
  bids:           BidRow[];
  vendors:        VendorRow[];
  recommendation: AwardRecommendationRow | null;
  anomalyAlerts:  AuctionAlertRow[];
  priceMetadata:  AuctionAiMetadata | null;
  exportedAt:     string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  ink:      '#0f172a',
  sub:      '#475569',
  muted:    '#94a3b8',
  accent:   '#2563eb',
  success:  '#16a34a',
  danger:   '#dc2626',
  warn:     '#ca8a04',
  border:   '#e2e8f0',
  faint:    '#f1f5f9',
  card:     '#f8fafc',
  blueCard: '#eff6ff',
  greenCard:'#f0fdf4',
  redCard:  '#fef2f2',
};

const PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#059669', '#b45309',
];
const LABELS = 'ABCDEFGHIJ'.split('');

// ─── SVG chart geometry ───────────────────────────────────────────────────────
// The SVG is always 523pt wide (full A4 content width, margins=36 each side).
// PLX=44 leaves room on the left for axis labels rendered as PDF Text elements.

const SVG_W    = 523;
const SVG_H    = 160;
const PLX      = 44;    // plot X start
const PLY      = 8;
const PLW      = SVG_W - PLX - 8;   // 471
const PLH      = SVG_H - PLY - 28;  // 124
const BAR_TRACK_W = 370;  // fixed px width for bar fills

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRs(paise: number): string {
  return 'Rs. ' + new Intl.NumberFormat('en-IN').format(Math.round(paise / 100));
}

function fmtRsShort(paise: number): string {
  const r = paise / 100;
  if (r >= 1_00_000) return `${(r / 1_00_000).toFixed(1)}L`;
  if (r >= 1_000)    return `${(r / 1_000).toFixed(0)}K`;
  return String(Math.round(r));
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtTimeShort(ts: number): string {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const m = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim();
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    AWARDED: 'AWARDED', CLOSED: 'CLOSED', RESERVE_NOT_MET: 'RESERVE NOT MET',
    OPEN: 'LIVE', PUBLISHED: 'SCHEDULED', DRAFT: 'DRAFT', CANCELLED: 'CANCELLED',
  };
  return m[s] ?? s;
}

function statusColor(s: string) {
  if (s === 'AWARDED')   return T.success;
  if (s === 'CLOSED')    return T.sub;
  if (s === 'OPEN')      return '#0891b2';
  if (s === 'CANCELLED') return T.danger;
  return T.muted;
}

function sevColor(s: string) {
  return s === 'HIGH' ? T.danger : s === 'MEDIUM' ? T.warn : T.muted;
}

function buildVendorMap(bids: BidRow[]): Map<string, string> {
  const m = new Map<string, string>();
  bids.filter(b => b.status === BidStatus.ACCEPTED).forEach(b => {
    if (!m.has(b.vendor_id)) m.set(b.vendor_id, `Bidder ${LABELS[m.size % 10]}`);
  });
  return m;
}

function svgPath(pts: Array<{ x: number; y: number }>): string {
  if (!pts.length) return '';
  const [f, ...r] = pts;
  return `M ${f.x.toFixed(1)} ${f.y.toFixed(1)} ${r.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 54,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: T.ink,
  },
  section:  { marginBottom: 16 },
  sectionTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: T.muted,
    letterSpacing: 1.2,
    paddingBottom: 6,
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: T.border,
  },

  // Cover
  coverTag: {
    fontSize: 7, fontFamily: 'Helvetica-Bold',
    color: T.muted, letterSpacing: 1.5, marginBottom: 6,
  },
  coverTitle: {
    fontSize: 20, fontFamily: 'Helvetica-Bold',
    color: T.ink, lineHeight: 1.2, marginBottom: 6,
  },
  coverMeta: { flexDirection: 'row', marginBottom: 16 },
  coverMetaItem: { fontSize: 8, color: T.sub, marginRight: 16 },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5,
  },
  coverBorder: {
    marginBottom: 20, paddingBottom: 16,
    borderBottomWidth: 2, borderBottomColor: T.ink,
  },

  // Metrics
  metricsRow: { flexDirection: 'row', marginBottom: 16 },
  metricCard: {
    flex: 1, backgroundColor: T.card,
    borderWidth: 1, borderColor: T.border,
    borderRadius: 4, padding: 10,
    marginRight: 8, borderTopWidth: 2,
  },
  metricLabel: {
    fontSize: 7, fontFamily: 'Helvetica-Bold',
    color: T.muted, letterSpacing: 0.8, marginBottom: 5,
  },
  metricValue: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  metricSub: { fontSize: 7, color: T.sub, marginTop: 2 },

  // Two-column
  twoCol:   { flexDirection: 'row' },
  col:      { flex: 1, marginRight: 16 },
  colLast:  { marginRight: 0 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 4,
    borderBottomWidth: 0.5, borderBottomColor: T.faint,
  },
  detailLabel: { fontSize: 8, color: T.sub },
  detailValue: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', color: T.ink,
    textAlign: 'right', maxWidth: '55%',
  },

  // Chart
  chartWrap: { position: 'relative', height: SVG_H, marginBottom: 4 },
  yAxisLabel: {
    position: 'absolute', left: 0, width: 40,
    fontSize: 6.5, color: T.muted, textAlign: 'right',
  },
  xAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xLabel:   { fontSize: 6.5, color: T.muted },

  // Legend
  legend:      { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 3 },
  legendSwatch:{ width: 14, height: 2, marginRight: 4 },
  legendDot:   { width: 7, height: 7, borderRadius: 3.5, marginRight: 4 },
  legendLabel: { fontSize: 7, color: T.sub },

  // Bar chart
  barRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6, height: 22 },
  barLabel: { width: 64, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: T.ink },
  barTrack: {
    width: BAR_TRACK_W, height: 14,
    backgroundColor: T.faint, borderRadius: 3,
    position: 'relative', marginRight: 8,
  },
  barFill: {
    position: 'absolute', top: 0, left: 0, height: 14, borderRadius: 3,
  },
  barAmount: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: T.ink, flex: 1 },

  // Table
  tHead: {
    flexDirection: 'row', backgroundColor: T.card,
    paddingVertical: 5, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: T.border,
    borderTopWidth: 0.5, borderTopColor: T.border,
  },
  tHeadCell: {
    fontSize: 7, fontFamily: 'Helvetica-Bold',
    color: T.muted, letterSpacing: 0.5,
  },
  tRow: {
    flexDirection: 'row', paddingVertical: 4.5,
    paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: T.faint,
  },
  tRowAlt: { backgroundColor: '#fafafa' },
  tCell:   { fontSize: 8, color: T.ink },
  tMono:   { fontSize: 7.5, fontFamily: 'Courier', color: T.ink },
  tMuted:  { fontSize: 8, color: T.sub },

  // AI cards
  aiCard: {
    backgroundColor: T.blueCard, borderWidth: 1,
    borderColor: '#bae6fd', borderRadius: 4, padding: 12, marginBottom: 8,
  },
  aiCardGreen: { backgroundColor: T.greenCard, borderColor: '#bbf7d0' },
  aiCardRed:   { backgroundColor: T.redCard,   borderColor: '#fca5a5' },
  aiCardTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: T.ink, marginBottom: 5 },
  aiText:      { fontSize: 8, color: T.sub, lineHeight: 1.5 },
  aiRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  aiKey:  { fontSize: 7.5, color: T.muted, width: 100 },
  aiVal:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: T.ink, flex: 1 },
  pill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
    fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3,
  },

  // Alerts
  alertRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 5, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: T.faint,
  },
  alertBadge: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3,
    fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3,
    marginRight: 8, width: 36, textAlign: 'center',
  },
  alertType: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: T.ink,
    width: 130, marginRight: 8, marginBottom: 2,
  },
  alertDesc: { fontSize: 7.5, color: T.sub, flex: 1, lineHeight: 1.4 },

  // Footer
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 6, borderTopWidth: 0.5, borderTopColor: T.border,
  },
  footerText: { fontSize: 7, color: T.muted },
});

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function LineSvg({ bids, ceilingPrice, vendorMap }: {
  bids: BidRow[];
  ceilingPrice: number;
  vendorMap: Map<string, string>;
}) {
  const accepted = bids.filter(b => b.status === BidStatus.ACCEPTED);
  if (!accepted.length) return null;

  const times   = accepted.map(b => new Date(b.submitted_at).getTime());
  const amounts = accepted.map(b => b.amount);
  const minTs   = Math.min(...times);
  const maxTs   = Math.max(...times) + 1;
  const minY    = Math.min(...amounts) * 0.96;
  const maxY    = Math.max(ceilingPrice * 1.01, ...amounts);

  function pt(ts: number, amt: number) {
    return {
      x: PLX + ((ts - minTs) / (maxTs - minTs)) * PLW,
      y: PLY + PLH - ((amt - minY) / (maxY - minY || 1)) * PLH,
    };
  }

  // 5 horizontal grid levels
  const grid = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    y: PLY + PLH - pct * PLH,
  }));

  const ceilY = pt(minTs, ceilingPrice).y;

  // Group bids by vendor label
  const groups = new Map<string, BidRow[]>();
  accepted.forEach(b => {
    const lbl = vendorMap.get(b.vendor_id)!;
    if (!groups.has(lbl)) groups.set(lbl, []);
    groups.get(lbl)!.push(b);
  });

  return (
    <Svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}>
      {/* Horizontal grid lines */}
      {grid.map((g, i) => (
        <SvgLine key={i} x1={PLX} y1={g.y} x2={PLX + PLW} y2={g.y}
          stroke={T.border} strokeWidth={0.5}
        />
      ))}

      {/* Ceiling reference line */}
      <SvgLine x1={PLX} y1={ceilY} x2={PLX + PLW} y2={ceilY}
        stroke={T.danger} strokeWidth={1} strokeDasharray="5 3"
      />

      {/* Vendor trend lines */}
      {Array.from(groups.entries()).map(([lbl, vBids], i) => {
        const color  = PALETTE[i % PALETTE.length]!;
        const sorted = [...vBids].sort((a, b) =>
          new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
        );
        const d = svgPath(sorted.map(b => pt(new Date(b.submitted_at).getTime(), b.amount)));
        return d ? (
          <Path key={lbl} d={d} stroke={color} strokeWidth={1.8}
            fill="none" strokeLinejoin="round" strokeLinecap="round"
          />
        ) : null;
      })}

      {/* X-axis baseline */}
      <SvgLine x1={PLX} y1={PLY + PLH} x2={PLX + PLW} y2={PLY + PLH}
        stroke={T.border} strokeWidth={0.5}
      />
    </Svg>
  );
}

// ─── Page header (non-cover pages) ───────────────────────────────────────────

function Hdr({ auction }: { auction: AuctionRow }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: T.border,
    }}>
      <View>
        <Text style={{ fontSize: 7, color: T.muted, letterSpacing: 1 }}>AUCTION REPORT</Text>
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: T.ink, marginTop: 1 }}>
          {auction.title}
        </Text>
      </View>
      <Text style={{ fontSize: 7, color: T.muted, fontFamily: 'Courier' }}>
        {auction.id.slice(0, 8).toUpperCase()}
      </Text>
    </View>
  );
}

function Ftr({ exportedAt }: { exportedAt: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>Generated {exportedAt} · Auction Engine</Text>
      <Text style={S.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
    </View>
  );
}

// ─── Page 1: Cover + Overview ─────────────────────────────────────────────────

function CoverPage({ d }: { d: AuctionReportData }) {
  const { auction, bids, vendors, priceMetadata } = d;
  const acc     = bids.filter(b => b.status === BidStatus.ACCEPTED);
  const bestBid = acc[0] ?? null;
  const uniq    = new Set(acc.map(b => b.vendor_id)).size;
  const savPct  = bestBid
    ? ((auction.ceiling_price - bestBid.amount) / auction.ceiling_price * 100).toFixed(1) + '%'
    : '—';
  const isForward = auction.type === AuctionType.FORWARD;

  const cards = [
    { label: 'TOTAL BIDS',    value: bids.length.toString(),                  color: T.accent  },
    { label: 'WINNING BID',   value: bestBid ? fmtRs(bestBid.amount) : '—',  color: T.success },
    { label: 'VENDORS',       value: uniq.toString(),                          color: '#0891b2' },
    { label: 'SAVINGS',       value: savPct,                                   color: T.success },
  ];

  return (
    <Page size="A4" style={S.page}>
      {/* Cover header */}
      <View style={S.coverBorder}>
        <Text style={S.coverTag}>AUCTION REPORT</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text style={S.coverTitle}>{auction.title}</Text>
          <Text style={[S.statusPill, { backgroundColor: statusColor(auction.status) + '22', color: statusColor(auction.status) }]}>
            {statusLabel(auction.status)}
          </Text>
        </View>
        <View style={S.coverMeta}>
          <Text style={S.coverMetaItem}>{auction.type.replace(/_/g, ' ')} AUCTION</Text>
          {auction.category ? <Text style={S.coverMetaItem}>{auction.category}</Text> : null}
          <Text style={S.coverMetaItem}>Generated {d.exportedAt}</Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={S.metricsRow}>
        {cards.map(({ label, value, color }, i) => (
          <View key={label} style={[S.metricCard, i === cards.length - 1 ? { marginRight: 0 } : {}, { borderTopColor: color }]}>
            <Text style={S.metricLabel}>{label}</Text>
            <Text style={[S.metricValue, { color }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Details */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>AUCTION DETAILS</Text>
        <View style={S.twoCol}>
          <View style={S.col}>
            {[
              ['Category',    auction.category || '—'],
              ['Quantity',    `${auction.quantity} ${auction.unit}`],
              [isForward ? 'Floor Price' : 'Ceiling Price', fmtRs(auction.ceiling_price)],
              [isForward ? 'Min Increment' : 'Min Decrement', fmtRs(auction.min_decrement)],
              ['Visibility',  auction.visibility.replace(/_/g, ' ')],
              ['Auto Extend', auction.auto_extend_enabled ? `${auction.auto_extend_minutes}m window` : 'Disabled'],
            ].map(([lbl, val]) => (
              <View key={lbl} style={S.detailRow}>
                <Text style={S.detailLabel}>{lbl}</Text>
                <Text style={S.detailValue}>{val}</Text>
              </View>
            ))}
          </View>
          <View style={[S.col, S.colLast]}>
            {[
              ['Started',       fmtDate(auction.start_time)],
              ['Closed',        fmtDate(auction.end_time)],
              ['Duration',      duration(auction.start_time, auction.end_time)],
              ['Total Bids',    bids.length.toString()],
              ['Accepted Bids', acc.length.toString()],
              ['Auction ID',    auction.id.slice(0, 8).toUpperCase()],
            ].map(([lbl, val]) => (
              <View key={lbl} style={S.detailRow}>
                <Text style={S.detailLabel}>{lbl}</Text>
                <Text style={S.detailValue}>{val}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Price intelligence summary */}
      {priceMetadata && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>PRICE INTELLIGENCE SUMMARY</Text>
          <View style={S.aiCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={S.aiCardTitle}>AI Market Benchmark</Text>
              {priceMetadata.confidence_level && (
                <Text style={[S.pill, {
                  backgroundColor:
                    priceMetadata.confidence_level === 'HIGH'   ? '#dcfce7' :
                    priceMetadata.confidence_level === 'MEDIUM' ? '#fef9c3' : '#fee2e2',
                  color:
                    priceMetadata.confidence_level === 'HIGH'   ? T.success :
                    priceMetadata.confidence_level === 'MEDIUM' ? T.warn    : T.danger,
                }]}>{priceMetadata.confidence_level} CONFIDENCE</Text>
              )}
            </View>
            <View style={S.twoCol}>
              <View style={S.col}>
                {priceMetadata.recommended_unit_price != null && (
                  <View style={S.aiRow}>
                    <Text style={S.aiKey}>Benchmark Price</Text>
                    <Text style={S.aiVal}>{fmtRs(priceMetadata.recommended_unit_price)}</Text>
                  </View>
                )}
                {priceMetadata.suggested_decrement != null && (
                  <View style={S.aiRow}>
                    <Text style={S.aiKey}>Suggested Decrement</Text>
                    <Text style={S.aiVal}>{fmtRs(priceMetadata.suggested_decrement)}</Text>
                  </View>
                )}
              </View>
              <View style={[S.col, S.colLast]}>
                {priceMetadata.comparable_count != null && (
                  <View style={S.aiRow}>
                    <Text style={S.aiKey}>Comparable Sources</Text>
                    <Text style={S.aiVal}>{priceMetadata.comparable_count}</Text>
                  </View>
                )}
                {priceMetadata.risk_threshold != null && (
                  <View style={S.aiRow}>
                    <Text style={S.aiKey}>Risk Threshold</Text>
                    <Text style={S.aiVal}>{fmtRs(priceMetadata.risk_threshold)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      <Ftr exportedAt={d.exportedAt} />
    </Page>
  );
}

// ─── Page 2: Charts ───────────────────────────────────────────────────────────

function ChartsPage({ d }: { d: AuctionReportData }) {
  const { auction, bids } = d;
  const acc        = bids.filter(b => b.status === BidStatus.ACCEPTED);
  const isForward  = auction.type === AuctionType.FORWARD;
  const vendorMap  = buildVendorMap(bids);

  // Y-axis grid labels (positioned absolutely over SVG)
  const amounts = acc.map(b => b.amount);
  const minY = amounts.length ? Math.min(...amounts) * 0.96 : 0;
  const maxY = amounts.length ? Math.max(auction.ceiling_price * 1.01, ...amounts) : auction.ceiling_price;
  const gridY = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    top:   PLY + PLH - pct * PLH - 4,   // -4 to vertically centre 7pt text
    label: fmtRsShort(minY + pct * (maxY - minY)),
  }));

  // X-axis labels
  const times = acc.map(b => new Date(b.submitted_at).getTime());
  const minTs = times.length ? Math.min(...times) : 0;
  const maxTs = times.length ? Math.max(...times) : 0;
  const midTs = Math.floor((minTs + maxTs) / 2);

  // Best bid per vendor for bar chart
  const bestByVendor = (() => {
    const map = new Map<string, number>();
    acc.forEach(b => {
      const lbl = vendorMap.get(b.vendor_id)!;
      const cur = map.get(lbl);
      const better = cur === undefined || (isForward ? b.amount > cur : b.amount < cur);
      if (better) map.set(lbl, b.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => isForward ? b[1] - a[1] : a[1] - b[1])
      .map(([lbl, amount], i) => ({ lbl, amount, color: PALETTE[i % PALETTE.length]!, isWinner: i === 0 }));
  })();

  const maxAmt = bestByVendor.length ? Math.max(...bestByVendor.map(v => v.amount)) : 1;

  // Savings vs ceiling
  const savPct = acc.length
    ? ((auction.ceiling_price - acc[0].amount) / auction.ceiling_price * 100)
    : null;

  // Bid count per vendor
  const bidCounts = Array.from(vendorMap.entries()).map(([vid, lbl], i) => ({
    lbl,
    count: acc.filter(b => b.vendor_id === vid).length,
    color: PALETTE[i % PALETTE.length]!,
  }));

  return (
    <Page size="A4" style={S.page}>
      <Hdr auction={auction} />

      {/* ── Price Trend ── */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>PRICE TREND — BID PROGRESSION OVER TIME</Text>

        {!acc.length ? (
          <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: T.card, borderRadius: 4, borderWidth: 0.5, borderColor: T.border }}>
            <Text style={{ fontSize: 8, color: T.muted }}>No accepted bids were recorded.</Text>
          </View>
        ) : (
          <>
            {/* Chart wrapper: SVG in normal flow, y-labels absolutely positioned */}
            <View style={S.chartWrap}>
              <LineSvg bids={bids} ceilingPrice={auction.ceiling_price} vendorMap={vendorMap} />
              {gridY.map((g, i) => (
                <Text key={i} style={[S.yAxisLabel, { top: g.top }]}>{g.label}</Text>
              ))}
            </View>

            {/* X-axis labels */}
            <View style={S.xAxisRow}>
              <Text style={S.xLabel}>{fmtTimeShort(minTs)}</Text>
              {maxTs > minTs && <Text style={S.xLabel}>{fmtTimeShort(midTs)}</Text>}
              <Text style={S.xLabel}>{fmtTimeShort(maxTs)}</Text>
            </View>

            {/* Legend */}
            <View style={S.legend}>
              <View style={S.legendItem}>
                <View style={[S.legendSwatch, { backgroundColor: T.danger }]} />
                <Text style={S.legendLabel}>{isForward ? 'Floor' : 'Ceiling'} ({fmtRs(auction.ceiling_price)})</Text>
              </View>
              {Array.from(vendorMap.values()).map((lbl, i) => (
                <View key={lbl} style={S.legendItem}>
                  <View style={[S.legendDot, { backgroundColor: PALETTE[i % PALETTE.length]! }]} />
                  <Text style={S.legendLabel}>{lbl}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* ── Vendor Comparison ── */}
      <View style={S.section}>
        <Text style={S.sectionTitle}>VENDOR COMPARISON — FINAL BEST BID</Text>
        {!bestByVendor.length ? (
          <View style={{ height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: T.card, borderRadius: 4, borderWidth: 0.5, borderColor: T.border }}>
            <Text style={{ fontSize: 8, color: T.muted }}>No bids to compare.</Text>
          </View>
        ) : (
          <>
            {bestByVendor.map(({ lbl, amount, color, isWinner }) => {
              const fillW = Math.max(4, Math.round((amount / maxAmt) * BAR_TRACK_W));
              return (
                <View key={lbl} style={S.barRow}>
                  <Text style={S.barLabel}>{lbl}</Text>
                  <View style={S.barTrack}>
                    <View style={[S.barFill, { width: fillW, backgroundColor: isWinner ? T.success : color }]} />
                  </View>
                  <Text style={[S.barAmount, { color: isWinner ? T.success : T.ink }]}>
                    {fmtRs(amount)}
                  </Text>
                </View>
              );
            })}

            {savPct != null && savPct > 0 && (
              <View style={[S.aiCard, S.aiCardGreen, { flexDirection: 'row', alignItems: 'center', padding: 8, marginTop: 6 }]}>
                <Text style={{ fontSize: 8, color: T.success, fontFamily: 'Helvetica-Bold', marginRight: 6 }}>
                  Total Savings:
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: T.success }}>
                  {savPct.toFixed(1)}%
                </Text>
                <Text style={{ fontSize: 8, color: T.sub, marginLeft: 6 }}>
                  vs. {isForward ? 'floor' : 'ceiling'} price of {fmtRs(auction.ceiling_price)}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Bid Activity ── */}
      {bidCounts.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>BID ACTIVITY — BIDS PLACED PER VENDOR</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {bidCounts.map(({ lbl, count, color }) => (
              <View key={lbl} style={{
                backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
                borderRadius: 4, padding: 8, marginRight: 8, marginBottom: 8,
                borderTopWidth: 2, borderTopColor: color, width: 95,
              }}>
                <Text style={{ fontSize: 7, color: T.muted, marginBottom: 3 }}>{lbl}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color }}>{count}</Text>
                <Text style={{ fontSize: 6.5, color: T.sub, marginTop: 1 }}>bids placed</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Ftr exportedAt={d.exportedAt} />
    </Page>
  );
}

// ─── Page 3: Bid History ──────────────────────────────────────────────────────

function BidHistoryPage({ d }: { d: AuctionReportData }) {
  const { auction, bids, vendors } = d;
  const acc        = bids.filter(b => b.status === BidStatus.ACCEPTED);
  const vendorMap  = buildVendorMap(bids);
  const vendorById = new Map(vendors.map(v => [v.id, v]));
  const isForward  = auction.type === AuctionType.FORWARD;

  const runningBest = new Map<string, number>();
  const rows = acc.map((bid, idx) => {
    const lbl  = vendorMap.get(bid.vendor_id) ?? `V${idx + 1}`;
    const name = bid.vendor_name ?? vendorById.get(bid.vendor_id)?.company_name ?? lbl;
    const prev = runningBest.get(bid.vendor_id);
    const isBetter = prev === undefined || (isForward ? bid.amount > prev : bid.amount < prev);
    if (isBetter) runningBest.set(bid.vendor_id, bid.amount);
    return { bid, lbl, name, isBetter };
  });

  const W = { rank: 22, name: 132, alias: 50, amount: 88, time: 80, note: 0 };

  return (
    <Page size="A4" style={S.page}>
      <Hdr auction={auction} />
      <View style={S.section}>
        <Text style={S.sectionTitle}>
          COMPLETE BID HISTORY — {acc.length} ACCEPTED BID{acc.length !== 1 ? 'S' : ''}
        </Text>

        <View style={S.tHead}>
          {[['#', W.rank], ['VENDOR NAME', W.name], ['ALIAS', W.alias], ['AMOUNT', W.amount], ['TIME', W.time], ['NOTE', 1]].map(
            ([h, w]) => <Text key={String(h)} style={[S.tHeadCell, { width: w === 1 ? undefined : w, flex: w === 1 ? 1 : undefined }]}>{h}</Text>
          )}
        </View>

        {rows.map(({ bid, lbl, name, isBetter }, i) => (
          <View key={bid.id} style={[S.tRow, i % 2 !== 0 ? S.tRowAlt : {}]} wrap={false}>
            <Text style={[S.tMuted, { width: W.rank }]}>#{i + 1}</Text>
            <Text style={[S.tCell, { width: W.name }]}>{name}</Text>
            <Text style={[S.tMuted, { width: W.alias }]}>{lbl}</Text>
            <Text style={[S.tMono, { width: W.amount, color: isBetter ? T.success : T.ink }]}>
              {fmtRs(bid.amount)}
            </Text>
            <Text style={[S.tMuted, { width: W.time, fontSize: 7.5 }]}>
              {fmtDate(bid.submitted_at).split(',').slice(1).join(',').trim()}
            </Text>
            <Text style={[S.tCell, { flex: 1, fontSize: 7, color: isBetter ? T.success : T.sub }]}>
              {isBetter ? 'New best' : 'Improved'}
            </Text>
          </View>
        ))}

        {!acc.length && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: T.muted }}>No accepted bids were recorded.</Text>
          </View>
        )}
      </View>
      <Ftr exportedAt={d.exportedAt} />
    </Page>
  );
}

// ─── Page 4: AI Intelligence ──────────────────────────────────────────────────

function AiPage({ d }: { d: AuctionReportData }) {
  const { auction, bids, vendors, recommendation, anomalyAlerts } = d;
  const vendorById = new Map(vendors.map(v => [v.id, v]));
  const vMap       = buildVendorMap(bids);

  const recVendor = recommendation?.primary_vendor_id
    ? vendorById.get(recommendation.primary_vendor_id)
    : null;
  const recLabel = recommendation?.primary_vendor_id
    ? (vMap.get(recommendation.primary_vendor_id) ?? 'Unknown')
    : null;

  return (
    <Page size="A4" style={S.page}>
      <Hdr auction={auction} />

      {recommendation && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>AI AWARD RECOMMENDATION</Text>
          <View style={[S.aiCard, S.aiCardGreen]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[S.aiCardTitle, { color: T.success }]}>Recommended Vendor</Text>
              {recommendation.confidence && (
                <Text style={[S.pill, {
                  backgroundColor:
                    recommendation.confidence === 'HIGH'   ? '#dcfce7' :
                    recommendation.confidence === 'MEDIUM' ? '#fef9c3' : '#fee2e2',
                  color:
                    recommendation.confidence === 'HIGH'   ? T.success :
                    recommendation.confidence === 'MEDIUM' ? T.warn    : T.danger,
                }]}>{recommendation.confidence} CONFIDENCE</Text>
              )}
            </View>
            <View style={S.aiRow}>
              <Text style={S.aiKey}>Vendor</Text>
              <Text style={[S.aiVal, { color: T.success, fontFamily: 'Helvetica-Bold' }]}>
                {recVendor?.company_name ?? recLabel ?? '—'}
              </Text>
            </View>
            {recommendation.primary_bid_amount != null && (
              <View style={S.aiRow}>
                <Text style={S.aiKey}>Recommended Bid</Text>
                <Text style={S.aiVal}>{fmtRs(recommendation.primary_bid_amount)}</Text>
              </View>
            )}
            {recommendation.primary_reason && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 7, color: T.muted, marginBottom: 3, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 }}>
                  PRIMARY REASON
                </Text>
                <Text style={S.aiText}>{recommendation.primary_reason}</Text>
              </View>
            )}
            {recommendation.risk_summary && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 7, color: T.muted, marginBottom: 3, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 }}>
                  RISK SUMMARY
                </Text>
                <Text style={S.aiText}>{recommendation.risk_summary}</Text>
              </View>
            )}
          </View>

          {recommendation.alternative_vendor_id && recommendation.alternative_bid_amount != null && (
            <View style={S.aiCard}>
              <Text style={S.aiCardTitle}>Alternative Vendor</Text>
              <View style={S.aiRow}>
                <Text style={S.aiKey}>Vendor</Text>
                <Text style={S.aiVal}>
                  {vendorById.get(recommendation.alternative_vendor_id)?.company_name ??
                   vMap.get(recommendation.alternative_vendor_id) ?? '—'}
                </Text>
              </View>
              <View style={S.aiRow}>
                <Text style={S.aiKey}>Bid Amount</Text>
                <Text style={S.aiVal}>{fmtRs(recommendation.alternative_bid_amount)}</Text>
              </View>
              {recommendation.alternative_reason && (
                <Text style={[S.aiText, { marginTop: 4 }]}>{recommendation.alternative_reason}</Text>
              )}
            </View>
          )}

          {recommendation.recommended_next_step && (
            <View style={S.aiCard}>
              <Text style={S.aiCardTitle}>Recommended Next Step</Text>
              <Text style={S.aiText}>{recommendation.recommended_next_step}</Text>
            </View>
          )}
        </View>
      )}

      {anomalyAlerts.length > 0 && (
        <View style={S.section}>
          <Text style={S.sectionTitle}>
            ANOMALY ALERTS — {anomalyAlerts.length} DETECTED
          </Text>
          <View style={{ borderWidth: 0.5, borderColor: T.border, borderRadius: 4, overflow: 'hidden' }}>
            <View style={[S.tHead, { backgroundColor: '#fff5f5' }]}>
              <Text style={[S.tHeadCell, { width: 44 }]}>SEV.</Text>
              <Text style={[S.tHeadCell, { width: 138 }]}>TYPE</Text>
              <Text style={[S.tHeadCell, { flex: 1 }]}>DESCRIPTION</Text>
            </View>
            {anomalyAlerts.map((alert, i) => {
              const sc = sevColor(alert.severity);
              return (
                <View key={alert.id} style={[S.alertRow, i % 2 !== 0 ? { backgroundColor: '#fafafa' } : {}]} wrap={false}>
                  <Text style={[S.alertBadge, { backgroundColor: sc + '18', color: sc }]}>
                    {alert.severity}
                  </Text>
                  <Text style={S.alertType}>{alert.alert_type.replace(/_/g, ' ')}</Text>
                  <Text style={S.alertDesc}>{alert.description}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <Ftr exportedAt={d.exportedAt} />
    </Page>
  );
}

// ─── Document export ──────────────────────────────────────────────────────────

export function AuctionReportPDF({ data }: { data: AuctionReportData }) {
  const hasAi = data.recommendation != null || data.anomalyAlerts.length > 0;
  return (
    <Document
      title={`Auction Report — ${data.auction.title}`}
      author="Auction Engine"
      subject="Auction Report"
      creator="Auction Engine"
    >
      <CoverPage d={data} />
      <ChartsPage d={data} />
      <BidHistoryPage d={data} />
      {hasAi && <AiPage d={data} />}
    </Document>
  );
}
