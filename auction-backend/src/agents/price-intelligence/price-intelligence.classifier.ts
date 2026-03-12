/**
 * Item classification for price intelligence.
 *
 * Classifies a procurement item into one of four buckets that drive
 * search strategy, evidence strictness, and quantity discount curve.
 */

export type ItemClass =
  | 'EXACT_CATALOG'   // Identified by brand + model — strict matching required
  | 'SPEC_DEFINED'    // Defined by specs (RAM, CPU, grade) — similarity-based
  | 'COMMODITY'       // Raw material / bulk measured good — per-unit pricing
  | 'SERVICE';        // Service / consulting — no physical pricing benchmark

/**
 * Units that indicate bulk physical goods priced per measure.
 * NOTE: generic countable units (pcs, piece, pieces, units, lot) are
 * intentionally excluded — they do not imply commodity bulk pricing on their own.
 */
const COMMODITY_UNITS =
  /^(kg|g|gram|grams|ton|tonne|tonnes|litre|liter|litres|liters|ml|m2|sqm|sqft|sheet|roll|metre|meter|metres|meters)$/i;

/**
 * Category keywords that indicate raw/bulk materials even when unit is
 * neutral (e.g. "lot", "pieces").
 */
const COMMODITY_CATEGORIES =
  /\b(raw material|chemical|metal|steel|alumin|plastic|polymer|resin|fabric|textile|grain|oil|fuel|aggregate|sand|cement|timber|wood|paper|rubber|glass)\b/i;

/** Category keywords that indicate a service engagement. */
const SERVICE_CATEGORIES =
  /\b(services?|consulting|consultancy|support|maintenance|installation|training|repair|audit|subscription|managed services?|professional services?|outsourc)\b/i;

/**
 * Spec keywords in title or category that indicate a specification-defined
 * product (not necessarily identifiable by brand/model).
 */
const SPEC_INDICATORS =
  /\b(ram|cpu|ssd|hdd|nvme|ghz|mhz|mb|gb|tb|grade|class|spec|specification|dimension|watt|volt|amp|mah|mp|core|thread|display|resolution|inch)\b/i;

/**
 * Classify a procurement item into one of four item classes.
 *
 * Rules evaluated top-to-bottom; first match wins:
 *  1. EXACT_CATALOG — both brand AND model present
 *  2. SPEC_DEFINED  — keySpecs provided, or spec indicators in title/category
 *  3. COMMODITY     — commodity unit or category keyword
 *  4. SERVICE       — service category without a commodity unit
 *  5. Default       — SPEC_DEFINED (safe fallback, still searches)
 *
 * @param input - Structured item details from the auction DTO
 * @returns ItemClass
 */
export function classifyItem(input: {
  brandName?: string;
  modelNumber?: string;
  keySpecs?: string;
  title: string;
  category: string;
  unit: string;
}): ItemClass {
  // EXACT_CATALOG: requires both a non-empty brand AND a non-empty model
  if (input.brandName?.trim() && input.modelNumber?.trim()) {
    return 'EXACT_CATALOG';
  }

  // SPEC_DEFINED: explicit specs provided, or spec keywords in title/category.
  // Evaluated before COMMODITY and SERVICE — a server with "16GB RAM" in the
  // title should be SPEC_DEFINED even if the category contains service keywords.
  if (
    input.keySpecs?.trim() ||
    SPEC_INDICATORS.test(`${input.title} ${input.category}`)
  ) {
    return 'SPEC_DEFINED';
  }

  // COMMODITY: weight/volume/area unit, or commodity category keywords
  if (
    COMMODITY_UNITS.test(input.unit.trim()) ||
    COMMODITY_CATEGORIES.test(input.category)
  ) {
    return 'COMMODITY';
  }

  // SERVICE: service engagement with no physical commodity unit
  if (
    SERVICE_CATEGORIES.test(input.category) &&
    !COMMODITY_UNITS.test(input.unit.trim())
  ) {
    return 'SERVICE';
  }

  // Safe default: SPEC_DEFINED (still searches, just without model enforcement)
  return 'SPEC_DEFINED';
}
