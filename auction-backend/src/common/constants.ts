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
} as const;

// ---------------------------------------------------------------------------
// HTTP / API
// ---------------------------------------------------------------------------

export const HTTP = {
  /** Global API route prefix applied in main.ts. */
  API_PREFIX: 'api/v1',
} as const;
