/**
 * Socket.IO singleton for all real-time auction events.
 *
 * Rules (enforced here, not in components):
 * - One socket connection per browser session
 * - All socket.on() calls are contained in this file
 * - Components call only the exported typed methods
 * - Cleanup functions returned from every `on*` method must be called on unmount
 */

import { io, type Socket } from 'socket.io-client';
import { config } from './config';
import { getAccessToken } from './supabase';
import type {
  BidAcceptedPayload,
  BidRejectedPayload,
  AuctionExtendedPayload,
  AuctionClosedPayload,
  AlertRaisedPayload,
  YourRankPayload,
  OutbidPayload,
  BidConfirmedPayload,
  NotificationEventPayload,
} from './types';

// ─── Singleton ───────────────────────────────────────────────────────────────

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket) return socket;

  const token = await getAccessToken();

  socket = io(config.wsUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function getSocket(): Socket {
  if (!socket) throw new Error('Socket not connected. Call connectSocket() first.');
  return socket;
}

// ─── Emit helpers (Client → Server) ──────────────────────────────────────────

export function joinAuction(auctionId: string, vendorId: string): void {
  getSocket().emit('join_auction', { auctionId, vendorId });
}

export function leaveAuction(auctionId: string): void {
  getSocket().emit('leave_auction', { auctionId });
}

// NOTE: Bids are submitted via REST (lib/api.ts bidsApi.submit).
// The place_bid socket event is only used for direct socket bidding if needed.

// ─── Event listeners (Server → Client) ───────────────────────────────────────
// Each returns a cleanup function to call on component unmount.

export function onBidAccepted(
  handler: (payload: BidAcceptedPayload) => void,
): () => void {
  getSocket().on('bid_accepted', handler);
  return () => getSocket().off('bid_accepted', handler);
}

export function onBidRejected(
  handler: (payload: BidRejectedPayload) => void,
): () => void {
  getSocket().on('bid_rejected', handler);
  return () => getSocket().off('bid_rejected', handler);
}

export function onAuctionExtended(
  handler: (payload: AuctionExtendedPayload) => void,
): () => void {
  getSocket().on('auction_extended', handler);
  return () => getSocket().off('auction_extended', handler);
}

export function onAuctionClosed(
  handler: (payload: AuctionClosedPayload) => void,
): () => void {
  getSocket().on('auction_closed', handler);
  return () => getSocket().off('auction_closed', handler);
}

export function onAlertRaised(
  handler: (payload: AlertRaisedPayload) => void,
): () => void {
  getSocket().on('alert_raised', handler);
  return () => getSocket().off('alert_raised', handler);
}

export function onYourRank(
  handler: (payload: YourRankPayload) => void,
): () => void {
  getSocket().on('your_rank', handler);
  return () => getSocket().off('your_rank', handler);
}

export function onOutbid(
  handler: (payload: OutbidPayload) => void,
): () => void {
  getSocket().on('outbid', handler);
  return () => getSocket().off('outbid', handler);
}

export function onBidConfirmed(
  handler: (payload: BidConfirmedPayload) => void,
): () => void {
  getSocket().on('bid_confirmed', handler);
  return () => getSocket().off('bid_confirmed', handler);
}

export function onNotification(
  handler: (payload: NotificationEventPayload) => void,
): () => void {
  getSocket().on('notification', handler);
  return () => getSocket().off('notification', handler);
}

export interface AgentRunCompletedPayload {
  agentType: string;
  agentRunId: string;
}

export function onAgentRunCompleted(
  handler: (payload: AgentRunCompletedPayload) => void,
): () => void {
  getSocket().on('agent_run_completed', handler);
  return () => getSocket().off('agent_run_completed', handler);
}
