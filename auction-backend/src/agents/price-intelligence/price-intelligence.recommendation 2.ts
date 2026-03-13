import { PRICE_INTELLIGENCE } from '../../common/constants';
import { AuctionType } from '../../common/types';
import type { ProcurementContext } from './price-intelligence.context';

/**
 * Deterministic web-evidence scoring and recommendation helpers for price intelligence.
 * Domain helper layer: no external I/O, only normalization and calculations.
 */

export type EvidenceStrength = 'STRONG' | 'WEAK' | 'NONE';
export type EvidenceSourceType =
  | 'MANUFACTURER'
  | 'DISTRIBUTOR'
  | 'B2B_SUPPLIER'
  | 'MARKETPLACE'
  | 'NEWS_OR_BLOG'
  | 'GENERIC';

export interface WebEvidenceSignal {
  amount: number;
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

export interface WebEvidenceSummary {
  median: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  mean: number | null;
  std_dev: number | null;
  count: number;
  strength: EvidenceStrength;
  avg_match_score: number;
  source_mix: Record<string, number>;
  signals: WebEvidenceSignal[];
}

export interface RiskStats {
  vendor_count: number;
  avg_delivery_success_rate: number;
  avg_quality_score: number;
  total_contracts: number;
  total_defaults: number;
  default_rate_pct: number;
}

export interface RecommendationSource {
  title: string;
  domain: string;
  url: string;
  source_type: EvidenceSourceType;
}

export interface PriceRecommendation {
  ceiling_price: number | null;
  suggested_decrement: number | null;
  risk_threshold: number | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_note: string | null;
  analysis_summary: string;
  evidence_sources: RecommendationSource[];
  market_context: string;
  evidence_breakdown: {
    web_match_count: number;
    source_mix: Record<string, number>;
  };
  failure_reason?: 'INSUFFICIENT_PRICING_EVIDENCE';
}

interface WeightedValue {
  amount: number;
  weight: number;
}

function roundMinorUnits(amount: number): number {
  return Math.max(0, Math.round(amount));
}

function weightedMean(values: ReadonlyArray<WeightedValue>): number | null {
  const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  const weightedTotal = values.reduce((sum, value) => sum + value.amount * value.weight, 0);
  return weightedTotal / totalWeight;
}

function weightedMedian(values: ReadonlyArray<WeightedValue>): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left.amount - right.amount);
  const totalWeight = sorted.reduce((sum, value) => sum + value.weight, 0);
  let runningWeight = 0;

  for (const value of sorted) {
    runningWeight += value.weight;
    if (runningWeight >= totalWeight / 2) {
      return value.amount;
    }
  }

  return sorted[sorted.length - 1]?.amount ?? null;
}

function percentile(values: ReadonlyArray<number>, fraction: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * fraction)));
  return sorted[index] ?? null;
}

function stdDeviation(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function resolveStrength(count: number, qualityScore: number): EvidenceStrength {
  if (count === 0) {
    return 'NONE';
  }
  if (count >= PRICE_INTELLIGENCE.STRONG_SIGNAL_COUNT && qualityScore >= 0.55) {
    return 'STRONG';
  }
  return 'WEAK';
}

/**
 * Summarize web pricing signals into weighted pricing statistics.
 */
export function summarizeWebEvidence(
  signals: ReadonlyArray<WebEvidenceSignal>,
): WebEvidenceSummary {
  const weightedValues = signals.map((signal) => ({
    amount: signal.amount,
    weight: Math.max(signal.weight, 0.01),
  }));
  const amounts = signals.map((signal) => signal.amount);
  const avgMatchScore =
    signals.length > 0
      ? signals.reduce((sum, signal) => sum + signal.match_score, 0) / signals.length
      : 0;
  const sourceMix = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.source_type] = (acc[signal.source_type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    median: weightedMedian(weightedValues),
    lower_bound: percentile(amounts, 0.2),
    upper_bound: percentile(amounts, 0.8),
    mean: weightedMean(weightedValues),
    std_dev: amounts.length > 0 ? stdDeviation(amounts) : null,
    count: signals.length,
    strength: resolveStrength(signals.length, avgMatchScore),
    avg_match_score: avgMatchScore,
    source_mix: sourceMix,
    signals: [...signals],
  };
}

function confidenceFromWebEvidence(webEvidence: WebEvidenceSummary): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (webEvidence.strength === 'STRONG') {
    return 'HIGH';
  }
  if (webEvidence.strength === 'WEAK') {
    return 'MEDIUM';
  }
  return 'LOW';
}

function buildRiskThreshold(
  auctionType: AuctionType,
  lowerBound: number | null,
  riskStats: RiskStats | null,
): { threshold: number | null; note: string | null } {
  if (auctionType === AuctionType.FORWARD || lowerBound == null) {
    return { threshold: null, note: null };
  }

  const defaultRate = riskStats?.default_rate_pct ?? 0;
  const deliveryShortfall = Math.max(0, 90 - (riskStats?.avg_delivery_success_rate ?? 90)) / 100;
  const qualityShortfall = Math.max(0, 80 - (riskStats?.avg_quality_score ?? 80)) / 100;
  const adjustment = Math.min(
    PRICE_INTELLIGENCE.MAX_RISK_THRESHOLD_RISK_ADJUSTMENT,
    defaultRate / 100 / 2 + deliveryShortfall / 2 + qualityShortfall / 2,
  );
  const threshold = roundMinorUnits(lowerBound * (1 + adjustment));
  const note =
    adjustment > 0
      ? 'Risk threshold was raised above the lower credible market band because vendor-performance data in this category shows elevated execution risk.'
      : 'Risk threshold follows the lower credible market band from current web pricing evidence.';

  return { threshold, note };
}

function topSources(webEvidence: WebEvidenceSummary): RecommendationSource[] {
  return webEvidence.signals
    .sort((left, right) => right.weight - left.weight)
    .slice(0, PRICE_INTELLIGENCE.MAX_SOURCE_PREVIEW_COUNT)
    .map((signal) => ({
      title: signal.source_title,
      domain: signal.source_domain,
      url: signal.source_url,
      source_type: signal.source_type,
    }));
}

/**
 * Combine web evidence and optional risk stats into a price recommendation.
 */
export function buildPriceRecommendation(input: {
  context: ProcurementContext;
  webEvidence: WebEvidenceSummary;
  riskStats: RiskStats | null;
}): PriceRecommendation {
  if (
    input.webEvidence.strength === 'NONE' ||
    input.webEvidence.median == null ||
    input.webEvidence.lower_bound == null ||
    input.webEvidence.upper_bound == null
  ) {
    return {
      ceiling_price: null,
      suggested_decrement: null,
      risk_threshold: null,
      confidence_level: 'LOW',
      risk_note: null,
      analysis_summary:
        `The agent could not find enough credible ${input.context.market} web pricing evidence for "${input.context.summary}" to recommend pricing safely.`,
      evidence_sources: topSources(input.webEvidence),
      market_context: input.context.market,
      evidence_breakdown: {
        web_match_count: input.webEvidence.count,
        source_mix: input.webEvidence.source_mix,
      },
      failure_reason: 'INSUFFICIENT_PRICING_EVIDENCE',
    };
  }

  const reverseCeiling = roundMinorUnits(
    Math.max(
      input.webEvidence.median,
      input.webEvidence.upper_bound * (1 + PRICE_INTELLIGENCE.REVERSE_CEILING_BUFFER_COEFFICIENT),
    ),
  );
  const forwardFloor = roundMinorUnits(input.webEvidence.lower_bound);
  const suggestedDecrement = roundMinorUnits(
    Math.max(
      PRICE_INTELLIGENCE.MIN_DECREMENT_PAISE,
      (input.webEvidence.std_dev ?? 0) * PRICE_INTELLIGENCE.DECREMENT_STDDEV_COEFFICIENT,
    ),
  );
  const riskThreshold = buildRiskThreshold(
    input.context.auctionType,
    input.webEvidence.lower_bound,
    input.riskStats,
  );

  return {
    ceiling_price:
      input.context.auctionType === AuctionType.FORWARD
        ? forwardFloor
        : reverseCeiling,
    suggested_decrement: suggestedDecrement,
    risk_threshold: riskThreshold.threshold,
    confidence_level: confidenceFromWebEvidence(input.webEvidence),
    risk_note: riskThreshold.note,
    analysis_summary:
      `I analyzed "${input.context.summary}" using ${input.webEvidence.count} current ${input.context.market} web pricing signals from supplier, distributor, marketplace, and manufacturer sources.`,
    evidence_sources: topSources(input.webEvidence),
    market_context: input.context.market,
    evidence_breakdown: {
      web_match_count: input.webEvidence.count,
      source_mix: input.webEvidence.source_mix,
    },
  };
}

/**
 * Classify a result source for evidence scoring and UI display.
 */
export function classifySourceType(text: string, domain: string): EvidenceSourceType {
  const haystack = `${domain} ${text}`.toLowerCase();
  if (/\bofficial\b|\boem\b|\bmanufacturer\b/.test(haystack)) {
    return 'MANUFACTURER';
  }
  if (/\bdistributor\b|\bdealer\b|\bchannel partner\b|\bauthorized reseller\b/.test(haystack)) {
    return 'DISTRIBUTOR';
  }
  if (/\bsupplier\b|\bwholesale\b|\bb2b\b|\bquote\b|\brfq\b|\bindiamart\b|\bmoglix\b|\bindustrybuying\b/.test(haystack)) {
    return 'B2B_SUPPLIER';
  }
  if (/\bamazon\b|\bflipkart\b|\bmarketplace\b/.test(haystack)) {
    return 'MARKETPLACE';
  }
  if (/\bnews\b|\bblog\b|\btrend\b|\bforecast\b/.test(haystack)) {
    return 'NEWS_OR_BLOG';
  }
  return 'GENERIC';
}
