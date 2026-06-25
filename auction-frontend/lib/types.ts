/**
 * All shared TypeScript types and enums for the auction engine frontend.
 * Values mirror the backend common/types.ts and DB schema exactly.
 * Import with `import type` for type-only usage.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export enum AuctionType {
  REVERSE   = 'REVERSE',
  FORWARD   = 'FORWARD',
  SEALED_BID = 'SEALED_BID',
}

export enum AuctionStatus {
  DRAFT           = 'DRAFT',
  PUBLISHED       = 'PUBLISHED',
  OPEN            = 'OPEN',
  PAUSED          = 'PAUSED',
  RESERVE_NOT_MET = 'RESERVE_NOT_MET',
  CLOSED          = 'CLOSED',
  AWARDED         = 'AWARDED',
  CANCELLED       = 'CANCELLED',
}

export enum TrafficLightStatus {
  GREEN    = 'GREEN',
  YELLOW   = 'YELLOW',
  RED      = 'RED',
  DISABLED = 'DISABLED',
}

export enum AuctionVisibility {
  BLIND = 'BLIND',
  RANK  = 'RANK',
  PRICE = 'PRICE',
}

export enum VendorStatus {
  PENDING   = 'PENDING',
  APPROVED  = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
}

export enum InvitationStatus {
  INVITED  = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum BidStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum BidRejectionReason {
  AUCTION_NOT_OPEN    = 'AUCTION_NOT_OPEN',
  VENDOR_NOT_ELIGIBLE = 'VENDOR_NOT_ELIGIBLE',
  ABOVE_CEILING       = 'ABOVE_CEILING',
  BELOW_DECREMENT     = 'BELOW_DECREMENT',
  RATE_LIMITED        = 'RATE_LIMITED',
}

export enum AgentType {
  PRICE_INTELLIGENCE   = 'PRICE_INTELLIGENCE',
  VENDOR_SHORTLIST     = 'VENDOR_SHORTLIST',
  ANOMALY_DETECTION    = 'ANOMALY_DETECTION',
  AWARD_RECOMMENDATION = 'AWARD_RECOMMENDATION',
}

export enum AgentRunStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED  = 'FAILED',
}

export enum AlertType {
  COLLUSION_SIGNAL = 'COLLUSION_SIGNAL',
  BELOW_RISK_BID   = 'BELOW_RISK_BID',
}

export enum AlertSeverity {
  LOW    = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH   = 'HIGH',
}

export enum ConfidenceLevel {
  HIGH   = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW    = 'LOW',
}

export enum NotificationType {
  AUCTION_OPEN        = 'AUCTION_OPEN',
  AUCTION_EXTENDED    = 'AUCTION_EXTENDED',
  BID_ACCEPTED        = 'BID_ACCEPTED',
  OUTBID              = 'OUTBID',
  AUCTION_CLOSED      = 'AUCTION_CLOSED',
  AWARD_ISSUED        = 'AWARD_ISSUED',
  INVITATION_RECEIVED = 'INVITATION_RECEIVED',
  AUCTION_UPDATED     = 'AUCTION_UPDATED',
  ANOMALY_ALERT       = 'ANOMALY_ALERT',
}

export enum ActorType {
  BUYER  = 'BUYER',
  VENDOR = 'VENDOR',
  SYSTEM = 'SYSTEM',
  AGENT  = 'AGENT',
}

// ─── API Response Envelope ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface CurrentUser {
  id: string;
  email: string;
  role: 'buyer' | 'vendor';
}

export interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

// ─── Auction ─────────────────────────────────────────────────────────────────

export interface AuctionRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
  type: AuctionType;
  status: AuctionStatus;
  buyer_id: string;
  start_time: string | null;
  end_time: string | null;
  ceiling_price: number;            // paise
  reserve_price: number | null;    // paise
  reserve_price_enabled: boolean;
  min_decrement: number;           // paise
  auto_extend_enabled: boolean;
  auto_extend_minutes: number;
  auto_extend_trigger: number;
  visibility: AuctionVisibility;
  cancellation_reason: string | null;
  winning_vendor_id: string | null;
  brand_name: string | null;
  model_number: string | null;
  key_specs: string | null;
  paused_at: string | null;
  paused_by: string | null;
  pause_reason: string | null;
  resumed_at: string | null;
  resumed_by: string | null;
  traffic_light_enabled: boolean;
  traffic_light_green_pct: number;
  traffic_light_yellow_pct: number;
  created_at: string;
  updated_at: string;
}

export interface LotRow {
  id: string;
  auction_id: string;
  title: string;
  quantity: number;
  unit: string;
  specifications: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  auction_id: string | null;
  actor_id: string | null;
  actor_type: ActorType | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type UpdateAuctionPayload = Partial<Omit<CreateAuctionPayload, 'type'>>;

export interface CreateAuctionPayload {
  title: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  brandName?: string;
  modelNumber?: string;
  keySpecs?: string;
  type: AuctionType;
  startTime?: string;
  endTime?: string;
  ceilingPrice: number;
  reservePrice?: number;
  reservePriceEnabled?: boolean;
  minDecrement?: number;
  autoExtendEnabled?: boolean;
  autoExtendMinutes?: number;
  autoExtendTrigger?: number;
  visibility?: AuctionVisibility;
  trafficLightEnabled?: boolean;
  trafficLightGreenPct?: number;
  trafficLightYellowPct?: number;
}

// ─── Reserve Price Enforcement ───────────────────────────────────────────────

export interface ReserveNotMetDetails {
  best_bid:      number;  // paise
  reserve_price: number;  // paise
  gap_amount:    number;  // paise
  gap_pct:       number;  // e.g. 12.50
}

export interface CloseAuctionResponse {
  status:                AuctionStatus;
  reserveNotMetDetails?: ReserveNotMetDetails;
}

export interface CreateLotPayload {
  title: string;
  quantity: number;
  unit: string;
  specifications?: string;
}

// ─── Bids ─────────────────────────────────────────────────────────────────────

export interface BidRow {
  id: string;
  auction_id: string;
  vendor_id: string;
  vendor_name?: string;
  amount: number;                      // paise
  status: BidStatus;
  rejection_reason: BidRejectionReason | null;
  submitted_at: string;
}

export interface BestBidResponse {
  bestBid: BidRow | null;
  totalBids: number;
  ranks: Record<string, number>;
  acceptedVendorCount: number;
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

export interface VendorRow {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string;
  email: string;
  category_tags: string[] | null;
  status: VendorStatus;
  created_at: string;
}

export interface VendorWithPerformance extends VendorRow {
  performance_scores: Array<{
    category: string;
    delivery_success_rate: number | null;
    quality_score: number | null;
    total_contracts: number;
    defaulted_contracts: number;
  }>;
  active_flags: Array<{
    flag_type: string;
    flag_reason: string | null;
    expires_at: string | null;
  }>;
}

export interface InvitationRow {
  id: string;
  auction_id: string;
  vendor_id: string;
  status: InvitationStatus;
  invited_at: string;
  responded_at: string | null;
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface AgentToolCall {
  tool_name: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface AgentRunRow {
  id: string;
  auction_id: string | null;
  agent_type: AgentType;
  triggered_at: string;
  completed_at: string | null;
  tool_calls: AgentToolCall[] | null;
  final_output: Record<string, unknown> | null;
  tokens_used: number | null;
  duration_ms: number | null;
  status: AgentRunStatus;
}

export interface AuctionAiMetadata {
  id: string;
  auction_id: string;
  opening_price: number | null;            // paise — replaces ceiling_price (semantically correct for both REVERSE and FORWARD)
  opening_price_type: string | null;       // 'CEILING' | 'FLOOR'
  suggested_reserve_price: number | null;  // paise — null when confidence is LOW
  reserve_price_basis: string | null;      // 'benchmark_plus_5pct' | 'benchmark_minus_5pct' | 'insufficient_evidence'
  reserve_confidence: string | null;       // 'HIGH' | 'MEDIUM' | null
  suggested_decrement: number | null;      // paise
  risk_threshold: number | null;           // paise
  recommended_unit_price: number | null;
  recommended_total_price: number | null;
  comparable_count: number | null;
  rejected_count: number | null;
  item_classification: string | null;
  risk_note: string | null;
  confidence_level: ConfidenceLevel | null;
  agent_run_id: string | null;
  created_at: string;
}

export interface AnalyzePriceIntelligencePayload {
  title: string;
  category: string;
  quantity: number;
  unit: string;
  type: AuctionType;
  description?: string;
  brandName?: string;
  modelNumber?: string;
  keySpecs?: string;
}

export interface PricingTrace {
  item_classification: string;
  queries_generated: string[];
  raw_candidates: Array<{
    url: string;
    title: string;
    detected_price_paise: number;
    per_unit_paise: number | null;
    rejection_reason: string | null;
    entity_score: number;
  }>;
  iqr_trace: {
    q1: number | null;
    q3: number | null;
    iqr: number | null;
    lower_fence: number | null;
    upper_fence: number | null;
    accepted_count: number;
    removed_count: number;
    removed_prices: number[];
  };
  quantity_adjustment: {
    benchmark_per_unit_paise: number;
    quantity: number;
    discount_pct: number;
    discounted_per_unit_paise: number;
    recommended_total_paise: number;
  } | null;
  comparable_count: number;
  rejected_count: number;
}

export interface PriceIntelligenceSuggestion {
  agent_run_id: string | null;
  analysis_summary: string;
  opening_price: number | null;            // paise — replaces ceiling_price
  opening_price_type: 'CEILING' | 'FLOOR';
  suggested_reserve_price: number | null;  // paise — null when confidence is LOW
  reserve_price_basis: 'benchmark_plus_5pct' | 'benchmark_minus_5pct' | 'insufficient_evidence';
  reserve_confidence: 'HIGH' | 'MEDIUM' | null;
  suggested_decrement: number | null;
  risk_threshold: number | null;
  recommended_unit_price: number | null;
  recommended_total_price: number | null;
  risk_note: string | null;
  confidence_level: ConfidenceLevel;
  evidence_sources: Array<{
    title: string;
    domain: string;
    url: string;
    source_type: string;
  }>;
  market_context: string;
  evidence_breakdown: {
    web_match_count: number;
    source_mix: Record<string, number>;
  };
  pricing_trace: PricingTrace;
  failure_reason?: 'INSUFFICIENT_PRICING_EVIDENCE';
}

export interface AuctionAlertRow {
  id: string;
  auction_id: string;
  agent_run_id: string | null;
  bid_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  description: string;
  vendor_ids_involved: string[] | null;
  created_at: string;
}

export interface AwardRecommendationRow {
  id: string;
  auction_id: string;
  agent_run_id: string | null;
  primary_vendor_id: string | null;
  primary_bid_amount: number | null;   // paise
  primary_reason: string | null;
  alternative_vendor_id: string | null;
  alternative_bid_amount: number | null; // paise
  alternative_reason: string | null;
  risk_summary: string | null;
  confidence: ConfidenceLevel | null;
  recommended_next_step: string | null;
  created_at: string;
}

/** Vendor shortlist entry returned by Agent 2 */
export interface ShortlistedVendor {
  vendor_id: string;
  company_name: string;
  score: number;
  tier: string;
  reason: string;
  caution_flags: string[];
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface NotificationEventPayload extends NotificationRow {}

// ─── Socket.IO Event Payloads ────────────────────────────────────────────────

/** Server → Room */
export interface BidAcceptedPayload {
  currentBestAmount?: number;  // paise — only if visibility is PRICE
  totalBids: number;
  timestamp: string;
}

export interface BidRejectedPayload {
  reason: string;
  submittedAmount: number;     // paise
}

export interface AuctionExtendedPayload {
  newEndTime: string;
  extensionMinutes: number;
}

export interface AuctionClosedPayload {
  auctionId: string;
  timestamp: string;
}

export interface AlertRaisedPayload {
  alertType: string;
  severity: string;
  description: string;
}

/** Server → Vendor (private) */
export interface YourRankPayload {
  rank: number;
  totalActiveBidders: number;
  traffic_light?: TrafficLightStatus;
}

export interface OutbidPayload {
  yourAmount: number;          // paise
  currentBestAmount: number;   // paise
}

export interface BidConfirmedPayload {
  bidId: string;
  amount: number;              // paise
  status: string;
  traffic_light?: TrafficLightStatus;
}

export interface AuctionPausedPayload {
  auctionId: string;
  reason?: string;
  pausedAt: string;
}

export interface AuctionResumedPayload {
  auctionId: string;
  resumedAt: string;
}

export interface AuctionOpenedPayload {
  auctionId: string;
  startedAt: string;
}

export interface AuctionAwardedPayload {
  auctionId: string;
  winningVendorId: string;
}

export interface AuctionCancelledPayload {
  auctionId: string;
  reason?: string;
  cancelledAt: string;
}

export interface ParticipantsChangedPayload {
  auctionId: string;
  vendorCount: number;
}

/** Client → Server */
export interface JoinAuctionPayload {
  auctionId: string;
  vendorId: string;
}

export interface PlaceBidPayload {
  auctionId: string;
  amount: number;              // paise
}

export interface LeaveAuctionPayload {
  auctionId: string;
}
