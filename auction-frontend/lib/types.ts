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
  DRAFT     = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  OPEN      = 'OPEN',
  CLOSED    = 'CLOSED',
  AWARDED   = 'AWARDED',
  CANCELLED = 'CANCELLED',
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
  type: AuctionType;
  status: AuctionStatus;
  buyer_id: string;
  start_time: string | null;
  end_time: string | null;
  ceiling_price: number;           // paise
  reserve_price: number | null;    // paise
  min_decrement: number;           // paise
  auto_extend_enabled: boolean;
  auto_extend_minutes: number;
  auto_extend_trigger: number;
  visibility: AuctionVisibility;
  cancellation_reason: string | null;
  winning_vendor_id: string | null;
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
  type: AuctionType;
  startTime?: string;
  endTime?: string;
  ceilingPrice: number;
  reservePrice?: number;
  minDecrement?: number;
  autoExtendEnabled?: boolean;
  autoExtendMinutes?: number;
  autoExtendTrigger?: number;
  visibility?: AuctionVisibility;
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
  amount: number;                      // paise
  status: BidStatus;
  rejection_reason: BidRejectionReason | null;
  submitted_at: string;
}

export interface BestBidResponse {
  bestBid: BidRow | null;
  totalBids: number;
  ranks: Record<string, number>;
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
  ceiling_price: number | null;        // paise
  suggested_decrement: number | null;  // paise
  risk_threshold: number | null;       // paise
  risk_note: string | null;
  confidence_level: ConfidenceLevel | null;
  agent_run_id: string | null;
  created_at: string;
}

export interface AnalyzePriceIntelligencePayload {
  title: string;
  category: string;
  type: AuctionType;
  description?: string;
}

export interface PriceIntelligenceSuggestion {
  agent_run_id: string | null;
  analysis_summary: string;
  ceiling_price: number;
  suggested_decrement: number;
  risk_threshold: number | null;
  risk_note: string | null;
  confidence_level: ConfidenceLevel;
}

export interface AuctionAlertRow {
  id: string;
  auction_id: string;
  agent_run_id: string | null;
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
  finalAmount: number;         // paise
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
}

export interface OutbidPayload {
  yourAmount: number;          // paise
  currentBestAmount: number;   // paise
}

export interface BidConfirmedPayload {
  bidId: string;
  amount: number;              // paise
  status: string;
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
