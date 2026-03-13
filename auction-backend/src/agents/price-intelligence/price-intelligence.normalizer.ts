import { PRICE_INTELLIGENCE } from '../../common/constants';
import type { WebEvidenceSignal } from './price-intelligence.recommendation';

/**
 * Quantity discount tiers — fraction of single-unit price at given quantity thresholds.
 * Applied when pricing_basis is PER_UNIT and quantity > 1.
 * e.g. ordering 50+ units typically yields a 10% discount.
 */
const QUANTITY_DISCOUNT_TIERS: Array<{ minQty: number; discount: number }> = [
  { minQty: 500, discount: 0.20 },
  { minQty: 100, discount: 0.15 },
  { minQty: 50,  discount: 0.10 },
  { minQty: 20,  discount: 0.07 },
  { minQty: 10,  discount: 0.05 },
  { minQty: 1,   discount: 0.00 },
];

/**
 * Returns the quantity discount fraction for a given quantity.
 * Returns 0.0 (no discount) for quantities with no applicable tier.
 */
export function getQuantityDiscount(quantity: number): number {
  for (const tier of QUANTITY_DISCOUNT_TIERS) {
    if (quantity >= tier.minQty) return tier.discount;
  }
  return 0;
}

/**
 * Removes outlier signals using IQR Tukey inner-fence method.
 * Always runs — the 3-signal minimum in the old code was incorrect
 * and allowed outlier contamination for small signal sets.
 *
 * Special case for exactly 2 signals: if the upper is more than
 * TWO_SIGNAL_MAX_RATIO times the lower, reject the lower (likely an EMI price).
 */
export function removeOutliersIQR(signals: ReadonlyArray<WebEvidenceSignal>): WebEvidenceSignal[] {
  if (signals.length <= 1) return [...signals];

  const sortedAmounts = signals.map((s) => s.amount).sort((a, b) => a - b);

  if (sortedAmounts.length === 2) {
    const lower = sortedAmounts[0]!;
    const upper = sortedAmounts[1]!;
    if (upper / lower > PRICE_INTELLIGENCE.TWO_SIGNAL_MAX_RATIO) {
      return signals.filter((s) => s.amount === upper);
    }
    return [...signals];
  }

  const q1Index = Math.floor(sortedAmounts.length / 4);
  const q3Index = Math.floor((3 * sortedAmounts.length) / 4);
  const q1 = sortedAmounts[q1Index]!;
  const q3 = sortedAmounts[q3Index]!;
  const iqr = q3 - q1;
  const lowerFence = q1 - PRICE_INTELLIGENCE.IQR_FENCE_MULTIPLIER * iqr;
  const upperFence = q3 + PRICE_INTELLIGENCE.IQR_FENCE_MULTIPLIER * iqr;

  return signals.filter((s) => s.amount >= lowerFence && s.amount <= upperFence);
}

/**
 * Applies minimum plausible price filter.
 * Rejects any signal below MIN_PLAUSIBLE_PRICE_PAISE — these are garbage regex
 * matches (coin values, review counts, etc. that appeared near an INR symbol).
 */
export function filterImplausible(signals: ReadonlyArray<WebEvidenceSignal>): WebEvidenceSignal[] {
  return signals.filter(
    (s) => s.amount >= PRICE_INTELLIGENCE.MIN_PLAUSIBLE_PRICE_PAISE,
  );
}
