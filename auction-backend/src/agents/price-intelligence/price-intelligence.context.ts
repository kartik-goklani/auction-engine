import type { ItemClass } from './price-intelligence.classifier';

export interface ProcurementContext {
  title: string;
  category: string;
  description?: string;
  brandName?: string;
  modelNumber?: string;
  keySpecs?: string;
  quantity: number;
  unit: string;
  itemClass: ItemClass;
  market: string;
}

export function buildProcurementContext(input: {
  title: string;
  category: string;
  description?: string;
  brandName?: string;
  modelNumber?: string;
  keySpecs?: string;
  quantity: number;
  unit: string;
  itemClass: ItemClass;
  market: string;
}): ProcurementContext {
  return { ...input };
}

/**
 * Builds the primary Serper search query string for a given procurement context.
 * ItemClass determines query specificity — EXACT_CATALOG uses brand+model,
 * COMMODITY uses unit+quantity, SPEC_DEFINED uses specs, SERVICE uses category.
 */
export function buildSearchQuery(context: ProcurementContext): string {
  const parts: string[] = [];

  if (context.itemClass === 'EXACT_CATALOG' && context.brandName && context.modelNumber) {
    parts.push(`${context.brandName} ${context.modelNumber}`);
  } else if (context.brandName) {
    parts.push(context.brandName);
  }

  parts.push(context.title);

  if (context.keySpecs) {
    parts.push(context.keySpecs);
  }

  if (context.itemClass === 'COMMODITY' && context.quantity > 1) {
    parts.push(`${context.quantity} ${context.unit}`);
  }

  parts.push('price', context.market);

  return parts.filter(Boolean).join(' ');
}

/**
 * Scores how well a piece of text matches the procurement context (0–1).
 * Used by web.ts to filter irrelevant page content before extracting prices.
 */
export function scoreContextMatch(context: ProcurementContext, text: string): number {
  const haystack = text.toLowerCase();
  let score = 0;
  let factors = 0;

  const titleWords = context.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (titleWords.length > 0) {
    const matched = titleWords.filter((w) => haystack.includes(w)).length;
    score += matched / titleWords.length;
    factors++;
  }

  score += haystack.includes(context.category.toLowerCase()) ? 1 : 0;
  factors++;

  if (context.brandName) {
    score += haystack.includes(context.brandName.toLowerCase()) ? 1 : 0;
    factors++;
  }

  if (context.modelNumber) {
    score += haystack.includes(context.modelNumber.toLowerCase()) ? 1 : 0;
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}
