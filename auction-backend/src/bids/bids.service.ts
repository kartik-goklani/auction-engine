import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BidsRepository, type BidRow, type BidRpcResult, type BidWithVendorName } from './bids.repository';
import { AuctionsService } from '../auctions/auctions.service';
import { VendorsService } from '../vendors/vendors.service';
import { AgentsService } from '../agents/agents.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AnomalyWindowService } from '../agents/anomaly-detection/anomaly-window.service';
import { AUCTION_DEFAULTS, ANOMALY, BID } from '../common/constants';
import {
  BidStatus,
  ActorType,
  NotificationType,
  AuctionType,
  AuctionStatus,
} from '../common/types';
import type { AuctionRow } from '../auctions/auctions.repository';
import { computeTrafficLight } from './traffic-light.util';

@Injectable()
export class BidsService {
  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly auctionsService: AuctionsService,
    private readonly vendorsService: VendorsService,
    private readonly agentsService: AgentsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
    private readonly anomalyWindowService: AnomalyWindowService,
  ) {}

  async submitBid(
    auctionId: string,
    vendorUserId: string,
    amount: number,
  ): Promise<BidRpcResult> {
    // Early-exit if the auction is paused — before any DB round-trips
    const auctionCheck = await this.auctionsService.findByIdPublic(auctionId);
    if (auctionCheck.status === AuctionStatus.PAUSED) {
      this.realtimeService.emitToUser(vendorUserId, 'bid_rejected', {
        reason: 'AUCTION_PAUSED',
        submittedAmount: amount,
      });
      return {
        id: '',
        auction_id: auctionId,
        vendor_id: '',
        amount,
        status: BidStatus.REJECTED,
        rejection_reason: 'AUCTION_PAUSED',
        submitted_at: new Date().toISOString(),
      } as BidRpcResult;
    }

    // Resolve vendor DB id from auth user id
    const vendorId = await this.vendorsService.getVendorIdByUserId(vendorUserId);

    // Delegate all five validation steps and the INSERT to the DB transaction
    const result = await this.bidsRepository.submitBidTransactional(
      auctionId,
      vendorId,
      amount,
    );

    if (result.status === BidStatus.REJECTED) {
      // Return rejection — do not throw; the rejection reason is the response
      this.realtimeService.emitToUser(vendorUserId, 'bid_rejected', {
        reason: result.rejection_reason,
        submittedAmount: amount,
      });
      return result;
    }

    // Bid was accepted — run post-acceptance pipeline
    await this.postAcceptancePipeline(auctionId, vendorId, vendorUserId, result);

    return result;
  }

  private async postAcceptancePipeline(
    auctionId: string,
    vendorId: string,
    vendorUserId: string,
    bid: BidRpcResult,
  ): Promise<void> {
    const auction = await this.auctionsService.findByIdPublic(auctionId);
    if (!auction) return;

    const totalBids = await this.bidsRepository.getAcceptedBidCount(auctionId);

    // Check and apply auto-extension
    const extended = await this.maybeExtendAuction(auction);

    // Emit bid_accepted to the room (visibility-filtered)
    this.realtimeService.emitBidAccepted(
      auctionId,
      auction.type as AuctionType,
      auction.visibility,
      bid.amount,
      totalBids,
      bid.submitted_at,
    );

    if (extended) {
      this.realtimeService.emitToAuction(auctionId, 'auction_extended', {
        newEndTime: extended.end_time,
        extensionMinutes: auction.auto_extend_minutes,
      });

      this.notificationsService.send(
        auction.buyer_id,
        NotificationType.AUCTION_EXTENDED,
        'Auction extended',
        `The auction end time was extended to ${new Date(extended.end_time ?? '').toLocaleTimeString('en-IN')}.`,
        { auctionId, newEndTime: extended.end_time, extensionMinutes: auction.auto_extend_minutes },
      );
    }

    // Compute traffic light for the bidding vendor — they just set the new best price
    const bidderTrafficLight = (auction.traffic_light_enabled && auction.type !== AuctionType.SEALED_BID)
      ? computeTrafficLight(
          auction.type as AuctionType,
          bid.amount,
          bid.amount, // vendor just set the best price — always GREEN at bid moment
          auction.traffic_light_green_pct,
          auction.traffic_light_yellow_pct,
        )
      : undefined;

    // Emit bid_confirmed privately to the bidding vendor
    this.realtimeService.emitToUser(vendorUserId, 'bid_confirmed', {
      bidId: bid.id,
      amount: bid.amount,
      status: bid.status,
      ...(bidderTrafficLight !== undefined && { traffic_light: bidderTrafficLight }),
    });

    // Emit updated rank privately to EVERY vendor who has bid (visibility-enforced inside RealtimeService)
    const ranks = await this.bidsRepository.getVendorRanks(auctionId, auction.type);
    const acceptedCount = await this.vendorsService.countAcceptedInvitations(auctionId);

    await Promise.all(
      Array.from(ranks.entries()).map(async ([vId, { rank, amount: vBidAmount }]) => {
        const userId = await this.vendorsService.getUserIdByVendorId(vId);
        if (!userId) return;

        const rankTrafficLight = (auction.traffic_light_enabled && auction.type !== AuctionType.SEALED_BID)
          ? computeTrafficLight(
              auction.type as AuctionType,
              vBidAmount,
              bid.amount, // bid.amount is always the new current best price
              auction.traffic_light_green_pct,
              auction.traffic_light_yellow_pct,
            )
          : undefined;

        this.realtimeService.emitRankToVendor(
          userId,
          auction.type as AuctionType,
          auction.visibility,
          rank,
          acceptedCount,
          rankTrafficLight,
        );
      }),
    );

    // Notify all other vendors they have been outbid (fire-and-forget per vendor)
    const topBids = await this.bidsRepository.getTopAcceptedBids(auctionId, auction.type, 2);
    const previousLeader = topBids.find((candidate) => candidate.vendor_id !== vendorId) ?? null;
    if (previousLeader) {
      const outbidUserId = await this.vendorsService.getUserIdByVendorId(previousLeader.vendor_id);
      if (outbidUserId) {
        this.realtimeService.emitToUser(outbidUserId, 'outbid', {
          yourAmount: previousLeader.amount,
          currentBestAmount: bid.amount,
        });
      }
    }

    // Tier 1: synchronous in-memory push — must run before the fire-and-forget boundary.
    // Risk threshold is read from AnomalyWindowService's internal cache (populated at auction OPEN).
    const bidRecord = {
      bidId:    bid.id,
      vendorId: bid.vendor_id,
      amount:   bid.amount,
      placedAt: new Date(bid.submitted_at),
    };
    const anomalyFlags = this.anomalyWindowService.push(bidRecord, auctionId);

    // Tier 2 gate: only fire the LLM agent when flags warrant investigation
    const hasHighFlag      = anomalyFlags.some((f) => f.severity === 'HIGH');
    const hasMultipleFlags = anomalyFlags.length >= ANOMALY.TIER2_MIN_FLAGS_FOR_MEDIUM;
    if (hasHighFlag || hasMultipleFlags) {
      // intentional fire-and-forget: anomaly detection must not block bid confirmation
      this.agentsService.runAnomalyDetection(auctionId, bidRecord, anomalyFlags);
    }

    // Fire-and-forget: notifications and audit
    this.notificationsService.send(
      vendorUserId,
      NotificationType.BID_ACCEPTED,
      'Your bid was accepted',
      undefined,
      { auctionId, bidId: bid.id, amount: bid.amount },
    );

    this.auditService.log({
      auctionId,
      actorId: vendorId,
      actorType: ActorType.VENDOR,
      action: 'BID_ACCEPTED',
      metadata: { bidId: bid.id, amount: bid.amount },
    });
  }

  private async maybeExtendAuction(auction: AuctionRow): Promise<AuctionRow | null> {
    if (!auction.auto_extend_enabled || auction.status !== AuctionStatus.OPEN) {
      return null;
    }
    if (!auction.end_time) return null;

    const endTime = new Date(auction.end_time).getTime();
    const now = Date.now();
    const remainingMs = endTime - now;
    const triggerMs =
      (auction.auto_extend_trigger ?? AUCTION_DEFAULTS.AUTO_EXTEND_TRIGGER_MINUTES) * 60 * 1_000 + BID.AUTO_EXTEND_TRIGGER_BUFFER_MS;

    if (remainingMs > triggerMs) return null;

    const newEndTime = new Date(
      now + (auction.auto_extend_minutes ?? AUCTION_DEFAULTS.AUTO_EXTEND_MINUTES) * 60 * 1_000,
    ).toISOString();

    // Delegate the end_time update to AuctionsService to respect layer boundaries
    return this.auctionsService.extendEndTime(auction.id, newEndTime);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findByAuction(auctionId: string): Promise<BidWithVendorName[]> {
    const bids = await this.bidsRepository.findByAuction(auctionId);
    const uniqueVendorIds = [...new Set(bids.map((b) => b.vendor_id))];
    const nameMap = await this.vendorsService.findNamesByIds(uniqueVendorIds);
    return bids.map((bid) => ({
      ...bid,
      vendor_name: nameMap.get(bid.vendor_id) ?? 'Unknown Vendor',
    }));
  }

  async findMyBids(auctionId: string, vendorUserId: string): Promise<BidRow[]> {
    const vendorId = await this.vendorsService.getVendorIdByUserId(vendorUserId);
    return this.bidsRepository.findByVendorAndAuction(vendorId, auctionId);
  }

  async getBestBid(auctionId: string): Promise<{
    bestBid: BidRow | null;
    totalBids: number;
    ranks: Record<string, number>;
    acceptedVendorCount: number;
  }> {
    const auction = await this.auctionsService.findByIdPublic(auctionId);
    if (!auction) throw new NotFoundException('Auction not found');

    const [bestBid, totalBids, ranksMap, acceptedVendorCount] = await Promise.all([
      this.bidsRepository.getBestBid(auctionId, auction.type),
      this.bidsRepository.getAcceptedBidCount(auctionId),
      this.bidsRepository.getVendorRanks(auctionId, auction.type),
      this.vendorsService.countAcceptedInvitations(auctionId),
    ]);

    return {
      bestBid,
      totalBids,
      ranks: Object.fromEntries(
        Array.from(ranksMap.entries()).map(([vId, { rank }]) => [vId, rank]),
      ),
      acceptedVendorCount,
    };
  }
}
