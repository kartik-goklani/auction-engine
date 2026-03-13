import type { SerperOrganicResult } from '../../common/lib/serper.client';
import { PRICE_INTELLIGENCE } from '../../common/constants';
import type { ProcurementContext } from './price-intelligence.context';
import {
  classifySourceType,
  type WebEvidenceSignal,
} from './price-intelligence.recommendation';
import { scoreContextMatch } from './price-intelligence.context';
import { removeOutliersIQR, filterImplausible } from './price-intelligence.normalizer';

/**
 * Web-evidence extraction helpers for price intelligence.
 * Domain helper layer: converts Serper search results into scored price signals.
 */

const INR_PRICE_PATTERN =
  /(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;

const PRODUCT_PRICE_HINTS = [
  'price',
  'mrp',
  'buy',
  'sale price',
  'list price',
  'offer price',
  'quote',
  'quotation',
  'starting at',
];

/**
 * Hard EMI/installment hints — ALWAYS reject a price candidate when any of
 * these appear in the extended (60-char) context window, regardless of
 * pricingBasis. These terms cannot co-occur with a valid product price.
 * Checked before the soft list so "₹6,999/month per unit" is caught even
 * though pricingBasis resolves to PER_UNIT (bypassing the old single guard).
 */
const HARD_EMI_HINTS = [
  'emi',
  'per month',
  '/month',
  'monthly',
  'subscription',
] as const;

/**
 * Soft non-price hints — only reject when pricingBasis is UNKNOWN and no
 * product-price hint is present. These terms sometimes appear near valid
 * prices (e.g. "warranty included"), so they are not unconditionally rejected.
 */
const SOFT_NON_PRICE_HINTS = [
  'warranty',
  'care plan',
  'insurance',
  'installation',
  'delivery fee',
  'service fee',
  'processing fee',
  'exchange bonus',
  'cashback',
] as const;

interface PriceCandidate {
  amount: number;
  contextWindow: string;
  focusedWindow: string;
  pricingBasis: 'TOTAL' | 'PER_UNIT' | 'UNKNOWN';
  entityScore: number;
  pricingIntentScore: number;
  overallScore: number;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInrToPaise(rawValue: string): number | null {
  const normalized = rawValue.replace(/,/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100);
}

function buildContextWindow(text: string, start: number, end: number, windowChars: number): string {
  const from = Math.max(0, start - windowChars);
  const to = Math.min(text.length, end + windowChars);
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}

function includesAny(text: string, fragments: ReadonlyArray<string>): boolean {
  const haystack = text.toLowerCase();
  return fragments.some((fragment) => haystack.includes(fragment));
}

function resolvePricingBasis(text: string): 'TOTAL' | 'PER_UNIT' | 'UNKNOWN' {
  const haystack = text.toLowerCase();
  if (/\bper unit\b|\beach\b|\/unit\b|\/piece\b|\bper piece\b|\bper license\b|\bper seat\b/.test(haystack)) {
    return 'PER_UNIT';
  }
  if (/\btotal\b|\bproject cost\b|\boverall\b|\bcontract value\b/.test(haystack)) {
    return 'TOTAL';
  }
  return 'UNKNOWN';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function fetchTrustedPageText(
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'auction-engine-price-intelligence/1.0' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return stripTags(html).slice(0, 12_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function recencyScore(date?: string): number {
  if (!date) {
    return 0.5;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return 0.5;
  }

  const ageDays = Math.max(0, (Date.now() - parsed.getTime()) / 86_400_000);
  if (ageDays <= 30) {
    return 1;
  }
  if (ageDays <= 180) {
    return 0.8;
  }
  if (ageDays <= 365) {
    return 0.65;
  }
  return 0.4;
}

function credibilityScore(sourceType: ReturnType<typeof classifySourceType>): number {
  switch (sourceType) {
    case 'MANUFACTURER':
      return 0.95;
    case 'DISTRIBUTOR':
      return 0.88;
    case 'B2B_SUPPLIER':
      return 0.82;
    case 'MARKETPLACE':
      return 0.68;
    case 'NEWS_OR_BLOG':
      return 0.35;
    default:
      return 0.5;
  }
}

function buildPriceCandidates(
  text: string,
  context: ProcurementContext,
  pageContextText: string,
): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  INR_PRICE_PATTERN.lastIndex = 0;
  let match = INR_PRICE_PATTERN.exec(text);

  while (match) {
    const rawAmount = normalizeInrToPaise(match[1] ?? '');
    if (rawAmount == null) {
      match = INR_PRICE_PATTERN.exec(text);
      continue;
    }

    const fullMatch = match[0] ?? '';
    const start = match.index;
    const end = start + fullMatch.length;
    const contextWindow = buildContextWindow(
      text,
      start,
      end,
      PRICE_INTELLIGENCE.PRICE_CONTEXT_WINDOW_CHARS,
    );
    const focusedWindow = buildContextWindow(text, start, end, 24);
    const normalizedWindow = focusedWindow.toLowerCase();
    const pricingBasis = resolvePricingBasis(focusedWindow);
    const entityScore = Math.max(
      scoreContextMatch(context, contextWindow),
      scoreContextMatch(context, `${pageContextText} ${contextWindow}`),
    );

    if (entityScore < PRICE_INTELLIGENCE.MIN_PRICE_CANDIDATE_MATCH_SCORE) {
      match = INR_PRICE_PATTERN.exec(text);
      continue;
    }

    const hasProductPriceHint = includesAny(normalizedWindow, PRODUCT_PRICE_HINTS);

    // Stage 1: hard EMI/installment check — always reject, uses wider window.
    // Checked before pricingBasis to catch "₹6,999/month per unit" where
    // pricingBasis resolves to PER_UNIT and would skip the old single guard.
    const extendedWindow = buildContextWindow(
      text, start, end, PRICE_INTELLIGENCE.FINANCE_HINT_WINDOW_CHARS,
    ).toLowerCase();
    if (includesAny(extendedWindow, HARD_EMI_HINTS)) {
      match = INR_PRICE_PATTERN.exec(text);
      continue;
    }

    // Stage 2: soft non-price hints — only reject when no product-price intent.
    if (
      includesAny(normalizedWindow, SOFT_NON_PRICE_HINTS) &&
      !hasProductPriceHint &&
      pricingBasis === 'UNKNOWN'
    ) {
      match = INR_PRICE_PATTERN.exec(text);
      continue;
    }

    const pricingIntentScore =
      hasProductPriceHint
        ? 1
        : pricingBasis === 'PER_UNIT' || pricingBasis === 'TOTAL'
          ? 0.85
          : 0.65;

    candidates.push({
      amount: rawAmount,
      contextWindow,
      focusedWindow,
      pricingBasis,
      entityScore,
      pricingIntentScore,
      overallScore: entityScore * 0.7 + pricingIntentScore * 0.3,
    });

    match = INR_PRICE_PATTERN.exec(text);
  }

  return candidates;
}

/**
 * Convert Serper results into scored web price signals.
 */
export async function extractWebEvidenceSignals(input: {
  context: ProcurementContext;
  results: SerperOrganicResult[];
  timeoutMs: number;
}): Promise<WebEvidenceSignal[]> {
  const dedupedResults = new Map<string, SerperOrganicResult>();

  for (const result of input.results) {
    if (!dedupedResults.has(result.link)) {
      dedupedResults.set(result.link, result);
    }
  }

  const normalizedResults = [...dedupedResults.values()];
  const textByUrl = new Map<string, string>();

  for (const result of normalizedResults.slice(0, PRICE_INTELLIGENCE.MAX_FETCHED_RESULT_PAGES)) {
    const domain = extractDomain(result.link);
    const sourceType = classifySourceType(
      `${result.title} ${result.snippet}`,
      domain,
    );

    if (sourceType === 'NEWS_OR_BLOG') {
      continue;
    }

    const pageText = await fetchTrustedPageText(result.link, input.timeoutMs);
    if (pageText) {
      textByUrl.set(result.link, pageText);
    }
  }

  const signals: WebEvidenceSignal[] = [];

  for (const result of normalizedResults) {
    const domain = extractDomain(result.link);
    const pageText = textByUrl.get(result.link) ?? '';
    const mergedText = `${result.title} ${result.snippet} ${pageText}`.trim();
    const candidates = buildPriceCandidates(
      mergedText,
      input.context,
      `${result.title} ${result.snippet}`,
    );
    if (candidates.length === 0) {
      continue;
    }

    const bestCandidate = [...candidates].sort((left, right) => {
      const scoreDiff = right.overallScore - left.overallScore;
      // When scores are within the tie threshold, prefer the higher-amount
      // candidate. This biases toward full product prices over EMI/accessory
      // prices that have similar entity-match scores.
      if (Math.abs(scoreDiff) < PRICE_INTELLIGENCE.CANDIDATE_SCORE_TIE_THRESHOLD) {
        return right.amount - left.amount;
      }
      return scoreDiff;
    })[0];

    if (!bestCandidate) {
      continue;
    }

    const sourceType = classifySourceType(mergedText, domain);
    const matchScore = scoreContextMatch(input.context, mergedText);
    const marketScore = mergedText.toLowerCase().includes(input.context.market.toLowerCase()) ? 1 : 0.75;
    const score = matchScore * 0.3 +
      bestCandidate.overallScore * 0.2 +
      credibilityScore(sourceType) * 0.25 +
      recencyScore(result.date) * 0.15 +
      marketScore * 0.1;

    if (score < PRICE_INTELLIGENCE.MIN_WEB_SIGNAL_SCORE) {
      continue;
    }

    const normalizedAmount = bestCandidate.amount;

    signals.push({
      amount: normalizedAmount,
      source_title: result.title,
      source_domain: domain,
      source_url: result.link,
      source_type: sourceType,
      match_score: Math.max(matchScore, bestCandidate.entityScore),
      recency_score: recencyScore(result.date),
      credibility_score: credibilityScore(sourceType),
      market_score: marketScore,
      pricing_basis:
        bestCandidate.pricingBasis === 'UNKNOWN' &&
        normalizedAmount !== bestCandidate.amount
          ? 'PER_UNIT'
          : bestCandidate.pricingBasis,
      weight: score,
    });
  }

  return removeOutliersIQR(filterImplausible(signals))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, PRICE_INTELLIGENCE.MAX_SOURCE_PREVIEW_COUNT * 2);
}
