import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { AuctionVisibility, AuctionType } from '../common/types';

export interface BidAcceptedPayload {
  currentBestAmount?: number;
  totalBids: number;
  timestamp: string;
}

export interface RankPayload {
  rank: number;
  totalActiveBidders: number;
}

export interface OutbidPayload {
  yourAmount: number;
  currentBestAmount: number;
}

export interface BidConfirmedPayload {
  bidId: string;
  amount: number;
  status: string;
}

export interface AuctionExtendedPayload {
  newEndTime: string;
  extensionMinutes: number;
}

export interface AuctionClosedPayload {
  finalAmount: number;
  timestamp: string;
}

export interface AlertRaisedPayload {
  alertType: string;
  severity: string;
  description: string;
}

export interface NotificationPayload {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  /**
   * Called by RealtimeGateway after the Socket.IO server is initialised.
   * All other methods are safe to call only after this has been set.
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /** Broadcast an event to everyone in the auction room. */
  emitToAuction(auctionId: string, event: string, payload: unknown): void {
    this.server?.to(`auction:${auctionId}`).emit(event, payload);
  }

  /** Deliver a notification to all sockets authenticated as a given user. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /**
   * Broadcast a bid_accepted event, filtering fields based on auction visibility.
   * - BLIND: no price information sent
   * - RANK: no price, rank sent privately per vendor
   * - PRICE: current best amount included in the room broadcast
   *
   * NOTE: Sealed bid overrides visibility to BLIND regardless of configuration.
   */
  emitBidAccepted(
    auctionId: string,
    auctionType: AuctionType,
    visibility: AuctionVisibility,
    currentBestAmount: number,
    totalBids: number,
    timestamp: string,
  ): void {
    const effectiveVisibility =
      auctionType === AuctionType.SEALED_BID
        ? AuctionVisibility.BLIND
        : visibility;

    const payload: BidAcceptedPayload = {
      totalBids,
      timestamp,
      ...(effectiveVisibility === AuctionVisibility.PRICE && { currentBestAmount }),
    };

    this.emitToAuction(auctionId, 'bid_accepted', payload);
  }

  /** Notify the auction room that a new agent run has completed. */
  emitAgentRunCompleted(auctionId: string, agentType: string, agentRunId: string): void {
    this.emitToAuction(auctionId, 'agent_run_completed', { agentType, agentRunId });
  }

  /**
   * Send rank to a vendor — only when visibility allows it.
   * Sealed bid never reveals rank during bidding.
   */
  emitRankToVendor(
    userId: string,
    auctionType: AuctionType,
    visibility: AuctionVisibility,
    rank: number,
    totalActiveBidders: number,
  ): void {
    if (auctionType === AuctionType.SEALED_BID) return;
    if (visibility === AuctionVisibility.BLIND) return;

    const payload: RankPayload = { rank, totalActiveBidders };
    this.emitToUser(userId, 'your_rank', payload);
  }
}
