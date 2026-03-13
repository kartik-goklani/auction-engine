import { AuctionType } from '../../common/types';

/**
 * Procurement-context helpers for the price-intelligence agent.
 * Domain helper layer: derives search context from auction text inputs.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'procurement',
  'purchase',
  'buy',
  'supply',
  'services',
  'service',
  'auction',
  'event',
  'contract',
]);

const MODELISH_PATTERN =
  /\b[A-Z][A-Za-z]+(?:[-\s]?[A-Z0-9]{2,})+\b|\b[A-Z0-9]{3,}(?:[-/][A-Z0-9]{2,})+\b/g;

export interface ProcurementContext {
  summary: string;
  keywords: string[];
  modelTokens: string[];
  exactQuery: string;
  supplierQuery: string;
  specQuery: string;
  trendQuery: string;
  quantity: number | null;
  quantityUnit: string | null;
  market: string;
  auctionType: AuctionType;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function uniquePreservingOrder(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

function extractModelTokens(input: string): string[] {
  const matches = input.match(MODELISH_PATTERN) ?? [];
  return uniquePreservingOrder(matches.map((match) => normalizeWhitespace(match)));
}

/**
 * Build a normalized procurement context from form inputs.
 */
export function buildProcurementContext(input: {
  title: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  market: string;
  auctionType: AuctionType;
}): ProcurementContext {
  const title = normalizeWhitespace(input.title);
  const description = normalizeWhitespace(input.description ?? '');
  const category = normalizeWhitespace(input.category);
  const combined = `${title} ${description} ${category}`.trim();
  const keywords = uniquePreservingOrder([
    ...tokenize(title),
    ...tokenize(description),
    ...tokenize(category),
  ]).slice(0, 14);
  const modelTokens = extractModelTokens(combined).slice(0, 6);
  const exactTerms = uniquePreservingOrder([title, description, category]).filter(Boolean).join(' ');
  const specTerms = uniquePreservingOrder([...modelTokens, ...keywords.slice(0, 8)]).join(' ');
  const normalizedUnit = normalizeWhitespace(input.unit).toLowerCase();
  const quantityPhrase = `${input.quantity} ${normalizedUnit}`.trim();

  return {
    summary: uniquePreservingOrder([title, description, category, quantityPhrase]).filter(Boolean).join(' | '),
    keywords,
    modelTokens,
    exactQuery: `${quantityPhrase} ${exactTerms} price ${input.market}`.trim(),
    supplierQuery: `${quantityPhrase} ${title} ${category} distributor supplier quote ${input.market}`.trim(),
    specQuery: `${quantityPhrase} ${specTerms || title} specifications price ${input.market}`.trim(),
    trendQuery: `${title || category} ${normalizedUnit} price trend ${input.market} ${new Date().getFullYear()}`.trim(),
    quantity: input.quantity,
    quantityUnit: normalizedUnit,
    market: input.market,
    auctionType: input.auctionType,
  };
}

/**
 * Score text relevance against the procurement context using keyword overlap.
 */
export function scoreContextMatch(
  context: ProcurementContext,
  text: string,
): number {
  const haystack = normalizeWhitespace(text).toLowerCase();
  if (!haystack) {
    return 0;
  }

  const haystackTokens = new Set(tokenize(haystack));
  const keywordMatches = context.keywords.filter((keyword) => haystackTokens.has(keyword)).length;
  const modelMatches = context.modelTokens.filter((token) => haystack.includes(token.toLowerCase())).length;
  const titlePhraseBoost = haystack.includes(context.summary.split('|')[0]?.trim().toLowerCase() ?? '') ? 0.15 : 0;
  const keywordScore = context.keywords.length > 0 ? keywordMatches / context.keywords.length : 0;
  const modelScore = context.modelTokens.length > 0 ? modelMatches / context.modelTokens.length : 0;

  return Math.max(
    0,
    Math.min(1, keywordScore * 0.65 + modelScore * 0.2 + titlePhraseBoost),
  );
}
