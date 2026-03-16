import { Injectable } from '@nestjs/common';
import { ANOMALY } from '../../common/constants';

// ── Public types ─────────────────────────────────────────────────────────────

export type AnomalyFlagType =
  | 'BELOW_RISK_THRESHOLD'
  | 'EXTREME_DROP'
  | 'COORDINATED_TIMING'
  | 'IDENTICAL_AMOUNTS'
  | 'SCRIPTED_BIDDING';

export type AnomalyFlagSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AnomalyFlag {
  type:              AnomalyFlagType;
  severity:          AnomalyFlagSeverity;
  vendorIdsInvolved: string[];
  /** Short human-readable reason, no LLM needed. */
  detail:            string;
}

export interface BidRecord {
  bidId:    string;
  vendorId: string;
  /** Always an integer in paise. */
  amount:   number;
  placedAt: Date;
}

// ── CircularBuffer ────────────────────────────────────────────────────────────

/**
 * Fixed-capacity circular buffer. push() is O(1). getAll() returns items
 * in chronological order (oldest first). When full, the oldest entry is
 * overwritten automatically.
 */
class CircularBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private writeIndex = 0;
  private count      = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<T | undefined>(capacity).fill(undefined);
  }

  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Returns all stored items in insertion order (oldest → newest). */
  getAll(): T[] {
    if (this.count === 0) return [];
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count) as T[];
    }
    // Buffer is full — oldest entry is at writeIndex
    const tail = this.buffer.slice(this.writeIndex) as T[];
    const head = this.buffer.slice(0, this.writeIndex) as T[];
    return [...tail, ...head];
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.writeIndex = 0;
    this.count      = 0;
  }
}

// ── AnomalyWindowService ──────────────────────────────────────────────────────

@Injectable()
export class AnomalyWindowService {
  /** In-memory sliding windows, keyed by auctionId. */
  private readonly windows = new Map<string, CircularBuffer<BidRecord>>();

  /**
   * Risk threshold (paise) per auction, cached at initAuction time.
   * Set once by Price Intelligence at auction creation — never changes mid-auction.
   */
  private readonly riskThresholds = new Map<string, number | null>();

  /**
   * Call when an auction transitions to OPEN.
   * Creates a fresh window and caches the risk threshold for the lifetime of the auction.
   *
   * @param riskThresholdPaise  From auction_ai_metadata — null if Price Intelligence has not run yet.
   */
  initAuction(auctionId: string, riskThresholdPaise: number | null): void {
    this.windows.set(auctionId, new CircularBuffer<BidRecord>(ANOMALY.WINDOW_SIZE));
    this.riskThresholds.set(auctionId, riskThresholdPaise);
  }

  /**
   * Call when an auction transitions to CLOSED or CANCELLED.
   * Frees memory for the auction window and cached risk threshold.
   */
  clearAuction(auctionId: string): void {
    this.windows.delete(auctionId);
    this.riskThresholds.delete(auctionId);
  }

  /**
   * Called on every accepted bid. Pushes the bid into the circular buffer and
   * runs all 5 Tier 1 checks synchronously. Returns an array of flags — empty
   * means the bid is clean.
   *
   * Risk threshold is read from the internal cache populated at initAuction time —
   * no DB round-trip on the hot bid path.
   *
   * @param bid        The accepted bid to evaluate.
   * @param auctionId  Auction the bid belongs to.
   */
  push(
    bid: BidRecord,
    auctionId: string,
  ): AnomalyFlag[] {
    // Defensive lazy-init: guards against scheduler race where a bid arrives
    // before the OPEN lifecycle hook fires.
    if (!this.windows.has(auctionId)) {
      this.windows.set(auctionId, new CircularBuffer<BidRecord>(ANOMALY.WINDOW_SIZE));
    }

    const window = this.windows.get(auctionId)!;
    const priorBids = window.getAll();

    // Read risk threshold from cache — set once at auction open, never fetched per-bid
    const riskThresholdPaise = this.riskThresholds.get(auctionId) ?? null;

    const flags = this.runChecks(priorBids, bid, riskThresholdPaise);

    // Push AFTER running checks so `buffer` in runChecks is clean prior state
    window.push(bid);

    return flags;
  }

  // ── Check orchestrator ──────────────────────────────────────────────────────

  private runChecks(
    buffer: BidRecord[],
    incoming: BidRecord,
    riskThresholdPaise: number | null,
  ): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];

    const f1 = this.checkBelowRiskThreshold(incoming, riskThresholdPaise);
    if (f1) flags.push(f1);

    const f2 = this.checkExtremeDrop(buffer, incoming);
    if (f2) flags.push(f2);

    const f3 = this.checkCoordinatedTiming(buffer, incoming);
    if (f3) flags.push(f3);

    const f4 = this.checkIdenticalAmounts(buffer, incoming);
    if (f4) flags.push(f4);

    const f5 = this.checkScriptedBidding(buffer, incoming);
    if (f5) flags.push(f5);

    return flags;
  }

  // ── CHECK 1: BELOW_RISK_THRESHOLD ──────────────────────────────────────────

  private checkBelowRiskThreshold(
    incoming: BidRecord,
    riskThresholdPaise: number | null,
  ): AnomalyFlag | null {
    if (
      riskThresholdPaise == null ||
      riskThresholdPaise <= 0 ||
      incoming.amount >= riskThresholdPaise
    ) {
      return null;
    }

    return {
      type:              'BELOW_RISK_THRESHOLD',
      severity:          'HIGH',
      vendorIdsInvolved: [incoming.vendorId],
      detail: `Bid of ₹${this.paise2rupees(incoming.amount)} is below risk floor of ₹${this.paise2rupees(riskThresholdPaise)}`,
    };
  }

  // ── CHECK 2: EXTREME_DROP ──────────────────────────────────────────────────

  private checkExtremeDrop(
    buffer: BidRecord[],
    incoming: BidRecord,
  ): AnomalyFlag | null {
    if (buffer.length < ANOMALY.EXTREME_DROP_MIN_WINDOW) return null;

    // Compute consecutive price drops among prior accepted bids
    const drops: number[] = [];
    for (let i = 0; i < buffer.length - 1; i++) {
      const drop = buffer[i].amount - buffer[i + 1].amount;
      drops.push(drop);
    }

    const medianDrop = this.median(drops);
    if (medianDrop <= 0) return null; // No downward trend — not a reverse auction pattern

    const incomingDrop = buffer[buffer.length - 1].amount - incoming.amount;
    if (incomingDrop <= medianDrop * ANOMALY.EXTREME_DROP_MULTIPLIER) return null;

    const ratio = incomingDrop / medianDrop;

    return {
      type:              'EXTREME_DROP',
      severity:          'HIGH',
      vendorIdsInvolved: [incoming.vendorId],
      detail: `Drop of ₹${this.paise2rupees(incomingDrop)} is ${ratio.toFixed(1)}× the median drop of ₹${this.paise2rupees(medianDrop)}`,
    };
  }

  // ── CHECK 3: COORDINATED_TIMING ────────────────────────────────────────────

  private checkCoordinatedTiming(
    buffer: BidRecord[],
    incoming: BidRecord,
  ): AnomalyFlag | null {
    // Need at least COLLUSION_MIN_BIDS total (prior + incoming)
    if (buffer.length + 1 < ANOMALY.COLLUSION_MIN_BIDS) return null;

    // Build a window of the most recent bids including incoming
    const recentPrior = buffer.slice(-(ANOMALY.COLLUSION_MIN_BIDS - 1));
    const recentBids  = [...recentPrior, incoming];

    let pairs = 0;
    const suspectedVendors = new Set<string>();

    for (let i = 0; i < recentBids.length - 3; i++) {
      const a = recentBids[i];
      const b = recentBids[i + 1];
      const c = recentBids[i + 2];
      const d = recentBids[i + 3];

      const gapAB = b.placedAt.getTime() - a.placedAt.getTime();
      const gapBC = c.placedAt.getTime() - b.placedAt.getTime();

      // Alternating pattern A→B→A→B within rapid windows
      if (
        a.vendorId !== b.vendorId &&
        a.vendorId === c.vendorId &&
        b.vendorId === d.vendorId &&
        gapAB < ANOMALY.COLLUSION_RAPID_WINDOW_MS &&
        gapBC < ANOMALY.COLLUSION_RAPID_WINDOW_MS
      ) {
        pairs++;
        suspectedVendors.add(a.vendorId);
        suspectedVendors.add(b.vendorId);
      }
    }

    if (suspectedVendors.size < 2 || pairs < ANOMALY.COLLUSION_MIN_PAIRS) return null;

    return {
      type:              'COORDINATED_TIMING',
      severity:          'HIGH',
      vendorIdsInvolved: Array.from(suspectedVendors),
      detail: `${pairs} rapid alternating bid pairs detected within ${ANOMALY.COLLUSION_RAPID_WINDOW_MS / 1_000}s windows`,
    };
  }

  // ── CHECK 4: IDENTICAL_AMOUNTS ─────────────────────────────────────────────

  private checkIdenticalAmounts(
    buffer: BidRecord[],
    incoming: BidRecord,
  ): AnomalyFlag | null {
    const allBids = [...buffer, incoming];

    // Group vendors by amount
    const amountVendors = new Map<number, Set<string>>();
    for (const bid of allBids) {
      if (!amountVendors.has(bid.amount)) {
        amountVendors.set(bid.amount, new Set());
      }
      amountVendors.get(bid.amount)!.add(bid.vendorId);
    }

    for (const [amount, vendors] of amountVendors) {
      if (vendors.size >= 2) {
        const n = vendors.size;
        return {
          type:              'IDENTICAL_AMOUNTS',
          severity:          'MEDIUM',
          vendorIdsInvolved: Array.from(vendors),
          detail: `Amount ₹${this.paise2rupees(amount)} placed by ${n} distinct vendors`,
        };
      }
    }

    return null;
  }

  // ── CHECK 5: SCRIPTED_BIDDING ──────────────────────────────────────────────

  private checkScriptedBidding(
    buffer: BidRecord[],
    incoming: BidRecord,
  ): AnomalyFlag | null {
    const vendorBids = [...buffer, incoming].filter(
      (b) => b.vendorId === incoming.vendorId,
    );

    if (vendorBids.length < ANOMALY.SCRIPTED_MIN_BIDS) return null;

    const intervals: number[] = [];
    for (let i = 1; i < vendorBids.length; i++) {
      intervals.push(vendorBids[i].placedAt.getTime() - vendorBids[i - 1].placedAt.getTime());
    }

    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    if (mean === 0) return null;

    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    if (cv >= ANOMALY.SCRIPTED_CV_THRESHOLD) return null;

    return {
      type:              'SCRIPTED_BIDDING',
      severity:          'HIGH',
      vendorIdsInvolved: [incoming.vendorId],
      detail: `Inter-bid interval CV of ${cv.toFixed(3)} is below human threshold of ${ANOMALY.SCRIPTED_CV_THRESHOLD} (${intervals.length} intervals measured)`,
    };
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private paise2rupees(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
