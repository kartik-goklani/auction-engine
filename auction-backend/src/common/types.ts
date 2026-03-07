// Shared enums and interfaces used across all modules.
// Values must stay in sync with CHECK constraints in the database schema.

export enum AuctionType {
  REVERSE = 'REVERSE',
  FORWARD = 'FORWARD',
  SEALED_BID = 'SEALED_BID',
}

export enum AuctionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  AWARDED = 'AWARDED',
  CANCELLED = 'CANCELLED',
}

export enum AuctionVisibility {
  BLIND = 'BLIND',
  RANK = 'RANK',
  PRICE = 'PRICE',
}

export enum VendorStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
}

export enum InvitationStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum BidStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum BidRejectionReason {
  AUCTION_NOT_OPEN = 'AUCTION_NOT_OPEN',
  VENDOR_NOT_ELIGIBLE = 'VENDOR_NOT_ELIGIBLE',
  ABOVE_CEILING = 'ABOVE_CEILING',
  BELOW_DECREMENT = 'BELOW_DECREMENT',
  RATE_LIMITED = 'RATE_LIMITED',
}

export enum AgentType {
  PRICE_INTELLIGENCE = 'PRICE_INTELLIGENCE',
  VENDOR_SHORTLIST = 'VENDOR_SHORTLIST',
  ANOMALY_DETECTION = 'ANOMALY_DETECTION',
  AWARD_RECOMMENDATION = 'AWARD_RECOMMENDATION',
}

export enum AgentRunStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum AlertType {
  COLLUSION_SIGNAL = 'COLLUSION_SIGNAL',
  BELOW_RISK_BID = 'BELOW_RISK_BID',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum NotificationType {
  AUCTION_OPEN = 'AUCTION_OPEN',
  BID_ACCEPTED = 'BID_ACCEPTED',
  OUTBID = 'OUTBID',
  AUCTION_CLOSED = 'AUCTION_CLOSED',
  AWARD_ISSUED = 'AWARD_ISSUED',
  INVITATION_RECEIVED = 'INVITATION_RECEIVED',
}

export enum ActorType {
  BUYER = 'BUYER',
  VENDOR = 'VENDOR',
  SYSTEM = 'SYSTEM',
  AGENT = 'AGENT',
}

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/** Extracted from the verified Supabase JWT on every protected request. */
export interface CurrentUser {
  id: string;
  email: string;
  role: 'buyer' | 'vendor';
}
