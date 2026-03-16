import { PRICE_INTELLIGENCE } from '../../common/constants';
import type { ProcurementContext } from './price-intelligence.context';

export type OpeningPriceType = 'CEILING' | 'FLOOR';
export type ReservePriceBasis =
  | 'benchmark_plus_5pct'
  | 'benchmark_minus_5pct'
  | 'insufficient_evidence';

export type EvidenceSourceType =
  | 'MANUFACTURER'
  | 'DISTRIBUTOR'
  | 'B2B_SUPPLIER'
  | 'MARKETPLACE'
  | 'NEWS_OR_BLOG'
  | 'UNKNOWN';

export interface WebEvidenceSignal {
  amount: number; // total paise (post quantity-normalization)
  source_title: string;
  source_domain: string;
  source_url: string;
  source_type: EvidenceSourceType;
  match_score: number;
  recency_score: number;
  credibility_score: number;
  market_score: number;
  pricing_basis: 'TOTAL' | 'PER_UNIT' | 'UNKNOWN';
  weight: number;
}

export interface PriceRecommendation {
  opening_price:            number;
  opening_price_type:       OpeningPriceType;
  suggested_reserve_price:  number | null;
  reserve_price_basis:      ReservePriceBasis;
  reserve_confidence:       'HIGH' | 'MEDIUM' | null;
  suggested_decrement: number;
  risk_threshold: number | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence_sources: Array<{ title: string; domain: string; url: string; source_type: string }>;
  market_context: string;
  evidence_breakdown: { web_match_count: number; source_mix: Record<string, number> };
  failure_reason?: 'INSUFFICIENT_PRICING_EVIDENCE';
}

// ── Quantity scaling helpers ──────────────────────────────────────────────

/**
 * Source types that list single-unit prices on their pages.
 * E-commerce and B2B pages never display a total contract price —
 * they always show the unit price, so quantity scaling is always required.
 */
const UNIT_PRICED_SOURCE_TYPES = new Set<EvidenceSourceType>([
  'MANUFACTURER',
  'DISTRIBUTOR',
  'B2B_SUPPLIER',
  'MARKETPLACE',
]);

/**
 * Bulk procurement discount tiers applied AFTER per-unit → total scaling.
 * Reflects typical volume pricing in Indian B2B procurement.
 */
const BULK_DISCOUNT_TIERS: Array<{ minQty: number; discount: number }> = [
  { minQty: 500, discount: 0.20 },
  { minQty: 100, discount: 0.15 },
  { minQty: 50,  discount: 0.10 },
  { minQty: 20,  discount: 0.07 },
  { minQty: 10,  discount: 0.05 },
  { minQty: 1,   discount: 0.00 },
];

function getBulkDiscount(quantity: number): number {
  for (const tier of BULK_DISCOUNT_TIERS) {
    if (quantity >= tier.minQty) return tier.discount;
  }
  return 0;
}

/**
 * Scales a signal's per-unit amount to a total contract value.
 *
 * Rules (applied in priority order):
 * 1. pricing_basis === 'TOTAL' → use as-is (already a contract total)
 * 2. pricing_basis === 'PER_UNIT' → multiply by quantity, apply bulk discount
 * 3. pricing_basis === 'UNKNOWN' + source not NEWS_OR_BLOG → treat as PER_UNIT
 *    (any product/retailer page shows unit prices regardless of domain recognition)
 * 4. pricing_basis === 'UNKNOWN' + NEWS_OR_BLOG → use as-is
 *    (news prices may describe total budgets or contract values, not unit prices)
 */
function scaleSignalToTotal(signal: WebEvidenceSignal, quantity: number): number {
  if (quantity <= 1) return signal.amount;

  if (signal.pricing_basis === 'TOTAL') {
    return signal.amount;
  }

  const shouldScale =
    signal.pricing_basis === 'PER_UNIT' ||
    (signal.pricing_basis === 'UNKNOWN' && signal.source_type !== 'NEWS_OR_BLOG');

  if (shouldScale) {
    const total = signal.amount * quantity;
    const discount = getBulkDiscount(quantity);
    return Math.round(total * (1 - discount));
  }

  return signal.amount;
}

// ── Source classification ─────────────────────────────────────────────────

const MANUFACTURER_DOMAINS =
  /\b(samsung\.com|dell\.com|hp\.com|lenovo\.com|apple\.com|bosch\.com|lg\.com|sony\.com|philips\.com|siemens\.com|hitachi\.com|toshiba\.com|canon\.com|cisco\.com|intel\.com|amd\.com|asus\.com|acer\.com|msi\.com)\b/;

const B2B_DOMAINS =
  /\b(indiamart\.com|tradeindia\.com|exportersindia\.com|alibaba\.com|made-in-china\.com|globalsources\.com|justdial\.com|sulekha\.com|dir\.indiamart\.com)\b/;

const DISTRIBUTOR_KEYWORDS =
  /\b(distributor|authorized dealer|authorised dealer|wholesale|wholesaler|stockist|reseller|dealership)\b/i;

const MARKETPLACE_DOMAINS =
  /\b(amazon\.in|flipkart\.com|snapdeal\.com|meesho\.com|tatacliq\.com|jiomart\.com|croma\.com|reliancedigital\.in|vijaysales\.com|paytmmall\.com)\b/;

const NEWS_BLOG_SIGNALS =
  /\b(blog|news|review|article|magazine|press release|report|interview|opinion|editorial)\b/i;

export function classifySourceType(text: string, domain: string): EvidenceSourceType {
  if (MANUFACTURER_DOMAINS.test(domain)) return 'MANUFACTURER';
  if (MARKETPLACE_DOMAINS.test(domain)) return 'MARKETPLACE';
  if (B2B_DOMAINS.test(domain)) return 'B2B_SUPPLIER';
  if (DISTRIBUTOR_KEYWORDS.test(text)) return 'DISTRIBUTOR';
  if (NEWS_BLOG_SIGNALS.test(text)) return 'NEWS_OR_BLOG';
  return 'UNKNOWN';
}

// ── Recommendation engine ─────────────────────────────────────────────────

/**
 * Computes the weighted median from a set of scored signals.
 * Signals sorted by amount; cumulative weight crosses 50% at the median.
 */
function weightedMedian(signals: ReadonlyArray<WebEvidenceSignal>): number {
  const sorted = [...signals].sort((a, b) => a.amount - b.amount);
  const totalWeight = sorted.reduce((sum, s) => sum + s.weight, 0);
  let cumWeight = 0;

  for (const signal of sorted) {
    cumWeight += signal.weight;
    if (cumWeight >= totalWeight / 2) {
      return signal.amount;
    }
  }

  return sorted[sorted.length - 1]!.amount;
}

/**
 * Deterministic price recommendation engine.
 * Takes web evidence signals + historical statistics and produces
 * a fully-computed PriceRecommendation. The LLM is never asked to
 * do arithmetic — it only provides analysis_summary text.
 */
export function buildPriceRecommendation(input: {
  signals: WebEvidenceSignal[];
  historicalMedian: number | null;
  historicalStdDev: number | null;
  context: ProcurementContext;
  auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID';
}): PriceRecommendation {
  const { signals, historicalMedian, historicalStdDev, context, auctionType } = input;

  const sourceMix: Record<string, number> = {};
  for (const signal of signals) {
    sourceMix[signal.source_type] = (sourceMix[signal.source_type] ?? 0) + 1;
  }

  const evidenceSources = signals
    .slice(0, PRICE_INTELLIGENCE.MAX_SOURCE_PREVIEW_COUNT)
    .map((s) => ({
      title: s.source_title,
      domain: s.source_domain,
      url: s.source_url,
      source_type: s.source_type,
    }));

  const evidenceBreakdown = { web_match_count: signals.length, source_mix: sourceMix };
  const isForward = auctionType === 'FORWARD';

  // No signals and no history → failure
  if (signals.length === 0 && historicalMedian == null) {
    return {
      opening_price:           0,
      opening_price_type:      'CEILING' as OpeningPriceType,
      suggested_reserve_price: null,
      reserve_price_basis:     'insufficient_evidence' as ReservePriceBasis,
      reserve_confidence:      null,
      suggested_decrement: PRICE_INTELLIGENCE.MIN_DECREMENT_PAISE,
      risk_threshold: null,
      confidence_level: 'LOW',
      evidence_sources: [],
      market_context: 'No pricing evidence found in web search or historical auctions.',
      evidence_breakdown: evidenceBreakdown,
      failure_reason: 'INSUFFICIENT_PRICING_EVIDENCE',
    };
  }

  const isStrongEvidence = signals.length >= PRICE_INTELLIGENCE.STRONG_SIGNAL_COUNT;

  // Scale each signal's amount to total contract value before benchmarking.
  // Web pages always show unit prices — multiply by quantity and apply bulk discount.
  const scaledSignals = signals.map((s) => ({
    ...s,
    amount: scaleSignalToTotal(s, context.quantity),
  }));

  // Compute benchmark: web evidence, historical, or blended
  let benchmarkPrice: number;

  if (scaledSignals.length > 0) {
    const webMedian = weightedMedian(scaledSignals);

    if (historicalMedian != null) {
      // Blend: web gets more weight when evidence is strong
      const webWeight = isStrongEvidence ? 0.65 : 0.5;
      benchmarkPrice = Math.round(webMedian * webWeight + historicalMedian * (1 - webWeight));
    } else {
      benchmarkPrice = webMedian;
    }
  } else {
    benchmarkPrice = historicalMedian!;
  }

  // Confidence computed before reserve price so calculateSuggestedReservePrice can receive it.
  // Depends only on signals.length and historicalMedian — no ordering issue.
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' = isStrongEvidence
    ? 'HIGH'
    : signals.length > 0 || historicalMedian != null
      ? 'MEDIUM'
      : 'LOW';

  // Opening price: ceiling for REVERSE/SEALED_BID, floor for FORWARD
  const { opening_price, opening_price_type } = calculateOpeningPrice(benchmarkPrice, auctionType);

  // Reserve price: sits between benchmark and opening price, null when evidence is LOW
  const { suggested_reserve_price, reserve_price_basis, reserve_confidence } =
    calculateSuggestedReservePrice(benchmarkPrice, auctionType, confidence, opening_price, opening_price_type);

  // Decrement: fraction of benchmark, floored at MIN_DECREMENT_PAISE
  const suggestedDecrement = Math.max(
    Math.round(benchmarkPrice * PRICE_INTELLIGENCE.DECREMENT_TOTAL_FRACTION),
    historicalStdDev != null
      ? Math.round(historicalStdDev * PRICE_INTELLIGENCE.DECREMENT_STDDEV_COEFFICIENT)
      : 0,
    PRICE_INTELLIGENCE.MIN_DECREMENT_PAISE,
  );

  const riskThreshold = isForward
    ? null
    : Math.round(benchmarkPrice * PRICE_INTELLIGENCE.RISK_THRESHOLD_MEDIAN_COEFFICIENT);

  const benchmarkRupees = (benchmarkPrice / 100).toLocaleString('en-IN');
  const unitPrice = context.quantity > 1 ? Math.round(benchmarkPrice / context.quantity) : benchmarkPrice;
  const unitRupees = (unitPrice / 100).toLocaleString('en-IN');
  const qtyLabel = context.quantity > 1 ? ` (≈₹${unitRupees}/unit × ${context.quantity} ${context.unit})` : '';
  const marketContext =
    signals.length > 0
      ? `Found ${signals.length} pricing signal(s) in ${context.market}. Total benchmark: ₹${benchmarkRupees}${qtyLabel}.`
      : `No web evidence found. Using historical auction data. Median: ₹${benchmarkRupees}${qtyLabel}.`;

  return {
    opening_price,
    opening_price_type,
    suggested_reserve_price,
    reserve_price_basis,
    reserve_confidence,
    suggested_decrement: suggestedDecrement,
    risk_threshold: riskThreshold,
    confidence_level: confidence,
    evidence_sources: evidenceSources,
    market_context: marketContext,
    evidence_breakdown: evidenceBreakdown,
  };
}

// ── Phase 3 helpers ───────────────────────────────────────────────────────

/**
 * Derives the opening price from the benchmark.
 * For REVERSE and SEALED_BID: 10% above benchmark (ceiling — vendors must beat it downward).
 * For FORWARD: 10% below benchmark (floor — vendors must bid upward from here).
 */
function calculateOpeningPrice(
  benchmarkPrice: number,
  auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID',
): { opening_price: number; opening_price_type: OpeningPriceType } {
  if (auctionType === 'FORWARD') {
    return {
      opening_price:      Math.round(benchmarkPrice * (1 - PRICE_INTELLIGENCE.FORWARD_FLOOR_BUFFER_COEFFICIENT)),
      opening_price_type: 'FLOOR',
    };
  }
  return {
    opening_price:      Math.round(benchmarkPrice * (1 + PRICE_INTELLIGENCE.REVERSE_CEILING_BUFFER_COEFFICIENT)),
    opening_price_type: 'CEILING',
  };
}

/**
 * Derives the suggested reserve price from the benchmark.
 * Reserve sits between benchmark and opening price — it is the fair-market-value boundary.
 * Returns null when confidence is LOW; no reliable benchmark means no reliable reserve.
 *
 * Sanity assertions check that the reserve always sits on the correct side of the
 * opening price — they surface any future regression if coefficients are ever changed.
 */
function calculateSuggestedReservePrice(
  benchmarkPrice: number,
  auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID',
  confidence: 'HIGH' | 'MEDIUM' | 'LOW',
  opening_price: number,
  opening_price_type: OpeningPriceType,
): {
  suggested_reserve_price: number | null;
  reserve_price_basis: ReservePriceBasis;
  reserve_confidence: 'HIGH' | 'MEDIUM' | null;
} {
  if (confidence === 'LOW') {
    return {
      suggested_reserve_price: null,
      reserve_price_basis:     'insufficient_evidence',
      reserve_confidence:      null,
    };
  }

  let suggested_reserve_price: number;
  let reserve_price_basis: ReservePriceBasis;

  if (auctionType === 'FORWARD') {
    suggested_reserve_price = Math.round(benchmarkPrice * (1 - PRICE_INTELLIGENCE.RESERVE_FORWARD_BUFFER_COEFFICIENT));
    reserve_price_basis     = 'benchmark_minus_5pct';
  } else {
    // REVERSE and SEALED_BID
    suggested_reserve_price = Math.round(benchmarkPrice * (1 + PRICE_INTELLIGENCE.RESERVE_REVERSE_BUFFER_COEFFICIENT));
    reserve_price_basis     = 'benchmark_plus_5pct';
  }

  // Sanity: reserve must sit between benchmark and opening price
  console.assert(
    opening_price_type === 'CEILING'
      ? suggested_reserve_price < opening_price
      : suggested_reserve_price > opening_price,
    `Reserve price sanity check failed: reserve=${suggested_reserve_price}, opening=${opening_price}, type=${opening_price_type}`,
  );

  return {
    suggested_reserve_price,
    reserve_price_basis,
    reserve_confidence: confidence === 'HIGH' ? 'HIGH' : 'MEDIUM',
  };
}
