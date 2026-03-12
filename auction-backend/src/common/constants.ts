/**
 * constants.ts — Single source of truth for all configurable values.
 *
 * Rules:
 *  - Never inline a model name, timeout, limit, or business default in feature code.
 *  - Runtime secrets and deployment-specific values go in .env via ConfigService.
 *    Everything else that is tunable but not secret goes here.
 */

// ---------------------------------------------------------------------------
// AI / LLM
// ---------------------------------------------------------------------------

export const AI = {
  /** OpenAI model used by all LangGraph ReAct agents. */
  MODEL: 'gpt-4o-mini',
  /**
   * Temperature for all agents. 0 = deterministic, reproducible outputs.
   * Procurement recommendations must not vary randomly between runs.
   */
  TEMPERATURE: 0,
  /**
   * Maximum tool-calling iterations per ReAct loop.
   * Safety cap — prevents runaway loops on unexpected model behaviour.
   */
  MAX_ITERATIONS: 10,
} as const;

// ---------------------------------------------------------------------------
// Agent tool query limits
// ---------------------------------------------------------------------------

export const AGENT_QUERY = {
  /** Maximum historical records each agent tool may fetch in one call. */
  MAX_LIMIT: 50,
  /** Default records returned when the LLM omits the limit parameter. */
  DEFAULT_LIMIT: 20,
} as const;

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

export const ANOMALY = {
  /**
   * Two consecutive bids separated by less than this many milliseconds are
   * flagged as a "rapid pair" — the core collusion detection signal.
   * Must match the 3-second rate limit enforced in the accept_bid_transaction RPC.
   */
  COLLUSION_RAPID_WINDOW_MS: 3_000,
  /**
   * Minimum number of accepted bids in the window required before the
   * timing-pattern analysis runs. Fewer bids cannot form a meaningful pattern.
   */
  COLLUSION_MIN_BIDS: 4,
  /**
   * Minimum number of rapid alternating pairs found before a COLLUSION_SIGNAL
   * alert is raised. Set to 2 to avoid false positives from a single coincidence.
   */
  COLLUSION_MIN_PAIRS: 2,
} as const;

// ---------------------------------------------------------------------------
// Bid pipeline
// ---------------------------------------------------------------------------

export const BID = {
  /**
   * Buffer added to the auto-extend trigger comparison to absorb processing lag.
   * Prevents narrowly missing the trigger window due to millisecond-level delays.
   */
  AUTO_EXTEND_TRIGGER_BUFFER_MS: 1_000,
} as const;

// ---------------------------------------------------------------------------
// Auction defaults (applied when a buyer omits optional fields on creation)
// ---------------------------------------------------------------------------

export const AUCTION_DEFAULTS = {
  MIN_DECREMENT: 0,
  AUTO_EXTEND_ENABLED: true,
  /** Minutes added to end_time when a bid arrives inside the trigger window. */
  AUTO_EXTEND_MINUTES: 2,
  /** Minutes before end_time at which an incoming bid triggers extension. */
  AUTO_EXTEND_TRIGGER_MINUTES: 2,
  VISIBILITY: 'RANK',
} as const;

// ---------------------------------------------------------------------------
// Price Intelligence agent coefficients
// ---------------------------------------------------------------------------

export const PRICE_INTELLIGENCE = {
  /**
   * Fraction of the historical std-dev used as the suggested minimum bid decrement.
   * e.g. 0.1 means suggested_decrement = stdDev × 0.1
   */
  DECREMENT_STDDEV_COEFFICIENT: 0.1,
  /**
   * Absolute floor for the suggested minimum bid decrement, in paise.
   * Prevents suggesting a trivially small decrement when std-dev is very low.
   * 10_000 paise = ₹100.
   */
  MIN_DECREMENT_PAISE: 10_000,
  /**
   * Fraction of the historical median applied to derive the risk threshold.
   * e.g. 0.85 means risk_threshold = median × 0.85
   * Bids below this level trigger a BELOW_RISK_BID anomaly alert.
   */
  RISK_THRESHOLD_MEDIAN_COEFFICIENT: 0.85,
  /**
   * Minimum weighted signal score required before a web price candidate is
   * considered usable in the market evidence set.
   */
  MIN_WEB_SIGNAL_SCORE: 0.45,
  /**
   * Maximum supporting sources shown in the buyer-facing AI suggestion modal.
   */
  MAX_SOURCE_PREVIEW_COUNT: 5,
  /**
   * Maximum trusted results whose page text may be fetched for price extraction.
   */
  MAX_FETCHED_RESULT_PAGES: 3,
  /**
   * Minimum number of usable signals that qualifies an evidence set as strong.
   */
  STRONG_SIGNAL_COUNT: 3,
  /**
   * Safety cap applied to reverse-auction ceiling recommendations when using
   * the upper credible price band. 0.10 = 10% buffer above the benchmark total.
   */
  REVERSE_CEILING_BUFFER_COEFFICIENT: 0.10,
  /**
   * Maximum upward adjustment applied to a reverse risk threshold based on
   * poor vendor performance in the category.
   */
  MAX_RISK_THRESHOLD_RISK_ADJUSTMENT: 0.05,
  /**
   * Number of characters captured around a detected price to judge whether it
   * is the actual product price, EMI text, or some unrelated fee/offer.
   */
  PRICE_CONTEXT_WINDOW_CHARS: 140,
  /**
   * Minimum candidate-level product match required before a page amount is
   * considered usable as actual pricing evidence. 0.40 = stricter entity match
   * to reduce false positives from unrelated product pages.
   */
  MIN_PRICE_CANDIDATE_MATCH_SCORE: 0.40,
  /**
   * IQR Tukey fence multiplier — standard robust outlier removal.
   * 1.5 is the standard "inner fence" (mild outliers). Values outside
   * Q1 - 1.5×IQR and Q3 + 1.5×IQR are rejected.
   */
  IQR_FENCE_MULTIPLIER: 1.5,
  /**
   * When only 2 candidates exist, reject the lower one if the upper is
   * more than this multiple of it. Prevents a single ₹118 EMI price from
   * surviving alongside a ₹60,000 real price.
   */
  TWO_SIGNAL_MAX_RATIO: 10,
  /**
   * Absolute minimum plausible price in paise (₹10). Any extracted price
   * below this is unconditionally rejected — protects against garbage regex
   * matches (coins, review counts, etc. appearing near INR symbols).
   */
  MIN_PLAUSIBLE_PRICE_PAISE: 1_000,
  /**
   * Floor buffer applied below the market benchmark for FORWARD auction
   * floor prices. 0.10 = 10% below benchmark total.
   */
  FORWARD_FLOOR_BUFFER_COEFFICIENT: 0.10,
  /**
   * Fraction of recommended total price used for the suggested min decrement.
   * e.g. 0.005 × ₹6,00,000 = ₹3,000 min decrement.
   */
  DECREMENT_TOTAL_FRACTION: 0.005,
  /**
   * Weight multiplier applied to evidence sources that explicitly mention
   * wholesale/bulk/B2B pricing when quantity is large. More weight = stronger
   * pull toward bulk-supplier prices in the weighted median.
   */
  BULK_SOURCE_WEIGHT_MULTIPLIER: 1.4,
} as const;

// ---------------------------------------------------------------------------
// HTTP / API
// ---------------------------------------------------------------------------

export const HTTP = {
  /** Global API route prefix applied in main.ts. */
  API_PREFIX: 'api/v1',
} as const;
