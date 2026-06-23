'use client';

/**
 * Derives all chart datasets from the raw bids array.
 * Every transformation is a pure function of the inputs and lives in a
 * dedicated useMemo so only affected datasets recompute on re-render.
 */

import { useMemo } from 'react';
import type { BidRow } from '@/lib/types';
import { BidStatus, AuctionType } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLOR_PALETTE = ['#22c55e', '#f97316', '#eab308', '#86efac', '#fdba74'] as const;
const VENDOR_LABELS = 'ABCDEFGHIJ'.split('');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrafficLightConfig {
  enabled:   boolean;
  greenPct:  number;
  yellowPct: number;
}

export interface UseBidChartDataResult {
  /** Maps vendor_id → display label ("Bidder A", "Bidder B", …) */
  vendorIndexMap:          Map<string, string>;
  /** Maps display label → hex color string */
  vendorColors:            Record<string, string>;
  /** Ordered list of { key, color } for rendering Recharts <Line> / <Bar> elements */
  vendorLines:             { key: string; color: string }[];
  /** One point per accepted bid — { ts, [vendorLabel]: amount } */
  allBidsData:             Record<string, number>[];
  /** Running best per vendor over time — { ts, [vendorLabel]: amount } */
  bestPriceData:           Record<string, number>[];
  /** Raw bid amount per submission (not running best) — fixes the Spread === Best Price bug */
  spreadData:              Record<string, number>[];
  /** Cumulative savings vs ceiling per bid — { ts, savingsPct } */
  savingsData:             { ts: number; savingsPct: number }[];
  /** Per-vendor rank at every bid timestamp — { ts, [vendorLabel]: rank } */
  rankTimelineData:        Record<string, number>[];
  /** Bid counts per 30-second window — { bucket, [vendorLabel]: count } */
  bidVelocityData:         Record<string, number | string>[];
  /** Vendor counts by traffic-light status */
  trafficLightData:        { GREEN: number; YELLOW: number; RED: number; DISABLED: number };
  /** Final best bid per vendor, sorted winner-first */
  awardGapData:            { vendor: string; finalBid: number }[];
  /** Per-vendor first/last bid and improvement % */
  bidImprovementData:      { vendor: string; firstBid: number; lastBid: number; improvementPct: number }[];
  /** Per-vendor bid count vs price drop % — used for scatter chart */
  bidCountVsPriceDropData: { vendor: string; bidCount: number; priceDrop: number }[];
  /** Total number of unique vendors who placed at least one accepted bid */
  vendorCount:             number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBidChartData(
  bids:                BidRow[],
  auctionType:         AuctionType,
  ceilingPrice:        number,
  trafficLightConfig?: TrafficLightConfig,
): UseBidChartDataResult {
  const isReverse = auctionType !== AuctionType.FORWARD;

  // ── Base: accepted bids sorted ascending by submission time ─────────────────
  const accepted = useMemo(
    () =>
      bids
        .filter((b) => b.status === BidStatus.ACCEPTED)
        .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()),
    [bids],
  );

  // ── Vendor index map (first-appearance order) ───────────────────────────────
  const vendorIndexMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    accepted.forEach((b) => {
      if (!map.has(b.vendor_id)) {
        const idx   = map.size;
        const label = `Bidder ${VENDOR_LABELS[idx] ?? idx}`;
        map.set(b.vendor_id, label);
      }
    });
    return map;
  }, [accepted]);

  // ── Colors keyed by display label ───────────────────────────────────────────
  const vendorColors = useMemo<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    let idx = 0;
    vendorIndexMap.forEach((label) => {
      result[label] = COLOR_PALETTE[idx % COLOR_PALETTE.length] as string;
      idx++;
    });
    return result;
  }, [vendorIndexMap]);

  // ── Ordered vendor lines for Recharts rendering ──────────────────────────────
  const vendorLines = useMemo<{ key: string; color: string }[]>(() => {
    const result: { key: string; color: string }[] = [];
    vendorIndexMap.forEach((label) => {
      result.push({ key: label, color: vendorColors[label] as string });
    });
    return result;
  }, [vendorIndexMap, vendorColors]);

  const vendorCount = vendorLines.length;

  // ── All Bids: one point per bid, the bidding vendor's column ─────────────────
  const allBidsData = useMemo<Record<string, number>[]>(() =>
    accepted.map((b) => {
      const label = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      return { ts: new Date(b.submitted_at).getTime(), [label]: b.amount };
    }),
    [accepted, vendorIndexMap],
  );

  // ── Best Price: running best per vendor ──────────────────────────────────────
  const bestPriceData = useMemo<Record<string, number>[]>(() => {
    const running: Record<string, number> = {};
    return accepted.map((b) => {
      const label    = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      const prev     = running[label];
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) running[label] = b.amount;
      return { ts: new Date(b.submitted_at).getTime(), ...running };
    });
  }, [accepted, vendorIndexMap, isReverse]);

  // ── Spread: raw bid amount at submission (fixes the Spread === Best Price bug) ─
  const spreadData = useMemo<Record<string, number>[]>(() =>
    accepted.map((b) => {
      const label = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      return { ts: new Date(b.submitted_at).getTime(), [label]: b.amount };
    }),
    [accepted, vendorIndexMap],
  );
  // Note: spreadData uses the same shape as allBidsData intentionally.
  // The distinction is in how the tab describes the data to the buyer:
  // allBidsData emphasises "every bid event" while spreadData is used on
  // the Spread tab which highlights the gap between vendor trajectories.

  // ── Savings Tracker: cumulative savings vs ceiling after each bid ─────────────
  const savingsData = useMemo<{ ts: number; savingsPct: number }[]>(() => {
    let overallBest: number | null = null;
    return accepted.map((b) => {
      const isBetter =
        overallBest == null || (isReverse ? b.amount < overallBest : b.amount > overallBest);
      if (isBetter) overallBest = b.amount;

      const best = overallBest as number;
      const savingsPct = ceilingPrice === 0
        ? 0
        : isReverse
          ? ((ceilingPrice - best) / ceilingPrice) * 100
          : ((best - ceilingPrice) / ceilingPrice) * 100;

      return { ts: new Date(b.submitted_at).getTime(), savingsPct };
    });
  }, [accepted, isReverse, ceilingPrice]);

  // ── Rank Timeline: per-vendor rank recomputed after each bid ─────────────────
  const rankTimelineData = useMemo<Record<string, number>[]>(() => {
    const runningBest: Record<string, number> = {};
    return accepted.map((b) => {
      const label    = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      const prev     = runningBest[label];
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) runningBest[label] = b.amount;

      // Recompute ranks across all vendors who have bid so far
      const entries = Object.entries(runningBest);
      entries.sort(([, a], [, b]) => isReverse ? a - b : b - a);

      const ranks: Record<string, number> = {};
      let rank = 1;
      for (let i = 0; i < entries.length; i++) {
        // Ties share the same rank
        if (i > 0) {
          const prevAmount = entries[i - 1]?.[1] as number;
          const currAmount = entries[i]?.[1] as number;
          if (currAmount !== prevAmount) rank = i + 1;
        }
        ranks[entries[i]?.[0] as string] = rank;
      }

      return { ts: new Date(b.submitted_at).getTime(), ...ranks };
    });
  }, [accepted, vendorIndexMap, isReverse]);

  // ── Bid Velocity: per-vendor bid counts per 30-second bucket ─────────────────
  const bidVelocityData = useMemo<Record<string, number | string>[]>(() => {
    if (accepted.length === 0) return [];
    const BUCKET_MS  = 30_000;
    const firstTs    = new Date(accepted[0]!.submitted_at).getTime();
    const buckets    = new Map<number, Record<string, number>>();

    accepted.forEach((b) => {
      const ts     = new Date(b.submitted_at).getTime();
      const offset = Math.floor((ts - firstTs) / BUCKET_MS) * BUCKET_MS;
      const label  = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      const row    = buckets.get(offset) ?? {};
      row[label]   = (row[label] ?? 0) + 1;
      buckets.set(offset, row);
    });

    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([offset, counts]) => {
        const bucketTs = firstTs + offset;
        const bucket   = new Date(bucketTs).toLocaleTimeString('en-IN', {
          hour:   '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        return { bucket, ...counts };
      });
  }, [accepted, vendorIndexMap]);

  // ── Traffic Light: vendor counts by status ───────────────────────────────────
  const trafficLightData = useMemo<{ GREEN: number; YELLOW: number; RED: number; DISABLED: number }>(() => {
    const vendorBests = new Map<string, number>();
    accepted.forEach((b) => {
      const prev     = vendorBests.get(b.vendor_id);
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) vendorBests.set(b.vendor_id, b.amount);
    });

    const counts = { GREEN: 0, YELLOW: 0, RED: 0, DISABLED: 0 };
    if (vendorBests.size === 0) return counts;

    if (!trafficLightConfig?.enabled) {
      counts.DISABLED = vendorBests.size;
      return counts;
    }

    // Overall best across all vendors
    const bestValues  = [...vendorBests.values()];
    const overallBest = isReverse
      ? Math.min(...bestValues)
      : Math.max(...bestValues);

    const { greenPct, yellowPct } = trafficLightConfig;

    vendorBests.forEach((vendorBest) => {
      if (overallBest === 0) { counts.DISABLED++; return; }
      const gapPct = isReverse
        ? ((vendorBest - overallBest) / overallBest) * 100
        : ((overallBest - vendorBest) / overallBest) * 100;

      if (gapPct <= greenPct)       counts.GREEN++;
      else if (gapPct <= yellowPct) counts.YELLOW++;
      else                          counts.RED++;
    });

    return counts;
  }, [accepted, isReverse, trafficLightConfig]);

  // ── Award Gap: final best bid per vendor, winner-first ───────────────────────
  const awardGapData = useMemo<{ vendor: string; finalBid: number }[]>(() => {
    const bests = new Map<string, number>();
    accepted.forEach((b) => {
      const label    = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      const prev     = bests.get(label);
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) bests.set(label, b.amount);
    });
    return [...bests.entries()]
      .map(([vendor, finalBid]) => ({ vendor, finalBid }))
      .sort((a, b) => isReverse ? a.finalBid - b.finalBid : b.finalBid - a.finalBid);
  }, [accepted, vendorIndexMap, isReverse]);

  // ── Bid Improvement: first vs last bid per vendor ────────────────────────────
  const bidImprovementData = useMemo<{ vendor: string; firstBid: number; lastBid: number; improvementPct: number }[]>(() => {
    const firstBids = new Map<string, number>();
    const lastBids  = new Map<string, number>();
    accepted.forEach((b) => {
      const label = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      if (!firstBids.has(label)) firstBids.set(label, b.amount);
      lastBids.set(label, b.amount);
    });

    return [...firstBids.entries()]
      .map(([vendor, firstBid]) => {
        const lastBid = lastBids.get(vendor) ?? firstBid;
        const improvementPct = firstBid === 0
          ? 0
          : isReverse
            ? ((firstBid - lastBid) / firstBid) * 100
            : ((lastBid - firstBid) / firstBid) * 100;
        return { vendor, firstBid, lastBid, improvementPct };
      })
      .sort((a, b) => b.improvementPct - a.improvementPct);
  }, [accepted, vendorIndexMap, isReverse]);

  // ── Bid Count vs Price Drop: scatter chart data ──────────────────────────────
  const bidCountVsPriceDropData = useMemo<{ vendor: string; bidCount: number; priceDrop: number }[]>(() => {
    const counts    = new Map<string, number>();
    const firstBids = new Map<string, number>();
    const bestBids  = new Map<string, number>();

    accepted.forEach((b) => {
      const label = vendorIndexMap.get(b.vendor_id) ?? 'Unknown';
      counts.set(label, (counts.get(label) ?? 0) + 1);
      if (!firstBids.has(label)) firstBids.set(label, b.amount);
      const prev     = bestBids.get(label);
      const isBetter = prev == null || (isReverse ? b.amount < prev : b.amount > prev);
      if (isBetter) bestBids.set(label, b.amount);
    });

    return [...counts.entries()].map(([vendor, bidCount]) => {
      const firstBid = firstBids.get(vendor) ?? 0;
      const bestBid  = bestBids.get(vendor)  ?? firstBid;
      const priceDrop = firstBid === 0
        ? 0
        : isReverse
          ? ((firstBid - bestBid) / firstBid) * 100
          : ((bestBid - firstBid) / firstBid) * 100;
      return { vendor, bidCount, priceDrop };
    });
  }, [accepted, vendorIndexMap, isReverse]);

  return {
    vendorIndexMap,
    vendorColors,
    vendorLines,
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
  };
}
