import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  AuctionsRepository,
  type AuctionRow,
  type LotRow,
  type AuditLogRow,
} from './auctions.repository';
import { AgentsService } from '../agents/agents.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VendorsService } from '../vendors/vendors.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AuctionStatus,
  ActorType,
  NotificationType,
  InvitationStatus,
} from '../common/types';
import type { CreateAuctionDto } from './dto/create-auction.dto';
import type { UpdateAuctionDto } from './dto/update-auction.dto';
import type { CreateLotDto } from './dto/create-lot.dto';

/** Valid forward-only state transitions. CANCELLED is allowed from any state. */
const VALID_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  [AuctionStatus.DRAFT]: [AuctionStatus.PUBLISHED, AuctionStatus.CANCELLED],
  [AuctionStatus.PUBLISHED]: [AuctionStatus.OPEN, AuctionStatus.CANCELLED],
  [AuctionStatus.OPEN]: [AuctionStatus.PAUSED, AuctionStatus.CLOSED, AuctionStatus.CANCELLED],
  [AuctionStatus.PAUSED]: [AuctionStatus.OPEN, AuctionStatus.CLOSED, AuctionStatus.CANCELLED],
  [AuctionStatus.CLOSED]: [AuctionStatus.AWARDED, AuctionStatus.CANCELLED],
  [AuctionStatus.AWARDED]: [AuctionStatus.CANCELLED],
  [AuctionStatus.CANCELLED]: [],
};

@Injectable()
export class AuctionsService {
  constructor(
    private readonly auctionsRepository: AuctionsRepository,
    private readonly agentsService: AgentsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly vendorsService: VendorsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async create(buyerId: string, dto: CreateAuctionDto): Promise<AuctionRow> {
    if (dto.startTime && new Date(dto.startTime) <= new Date()) {
      throw new BadRequestException('Start time must be in the future');
    }
    if (dto.startTime && dto.endTime && new Date(dto.endTime) <= new Date(dto.startTime)) {
      throw new BadRequestException('End time must be after start time');
    }
    const auction = await this.auctionsRepository.create(buyerId, dto);

    this.auditService.log({
      auctionId: auction.id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_CREATED',
      metadata: { type: auction.type, category: auction.category },
    });

    // Non-blocking: price intelligence runs in the background
    this.agentsService.runPriceIntelligence(auction.id);

    return auction;
  }

  findByBuyer(buyerId: string): Promise<AuctionRow[]> {
    return this.auctionsRepository.findByBuyer(buyerId);
  }

  async findById(id: string, buyerId: string): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    if (auction.buyer_id !== buyerId) {
      throw new ForbiddenException('You do not own this auction');
    }
    return auction;
  }

  async findByIdPublic(id: string): Promise<AuctionRow> {
    return this.auctionsRepository.findById(id);
  }

  // ── Field update (DRAFT / PUBLISHED only) ─────────────────────────────────

  async update(id: string, buyerId: string, dto: UpdateAuctionDto): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);

    if (
      auction.status !== AuctionStatus.DRAFT &&
      auction.status !== AuctionStatus.PUBLISHED
    ) {
      throw new UnprocessableEntityException(
        'Auction fields can only be edited in DRAFT or PUBLISHED state',
      );
    }

    // Build the patch — only include defined fields
    const patch: Partial<Pick<AuctionRow,
      'title' | 'description' | 'category' | 'start_time' | 'end_time' |
      'quantity' | 'unit' | 'ceiling_price' | 'reserve_price' | 'min_decrement' |
      'auto_extend_enabled' | 'auto_extend_minutes' | 'auto_extend_trigger' | 'visibility' |
      'brand_name' | 'model_number' | 'key_specs' |
      'traffic_light_enabled' | 'traffic_light_green_pct' | 'traffic_light_yellow_pct'
    >> = {};
    if (dto.title            !== undefined) patch.title                = dto.title;
    if (dto.description      !== undefined) patch.description          = dto.description;
    if (dto.category         !== undefined) patch.category             = dto.category;
    if (dto.quantity         !== undefined) patch.quantity             = dto.quantity;
    if (dto.unit             !== undefined) patch.unit                 = dto.unit;
    if (dto.startTime        !== undefined) patch.start_time           = dto.startTime;
    if (dto.endTime          !== undefined) patch.end_time             = dto.endTime;
    if (dto.ceilingPrice     !== undefined) patch.ceiling_price        = dto.ceilingPrice;
    if (dto.reservePrice     !== undefined) patch.reserve_price        = dto.reservePrice;
    if (dto.minDecrement     !== undefined) patch.min_decrement        = dto.minDecrement;
    if (dto.autoExtendEnabled !== undefined) patch.auto_extend_enabled = dto.autoExtendEnabled;
    if (dto.autoExtendMinutes !== undefined) patch.auto_extend_minutes = dto.autoExtendMinutes;
    if (dto.autoExtendTrigger !== undefined) patch.auto_extend_trigger = dto.autoExtendTrigger;
    if (dto.visibility       !== undefined) patch.visibility           = dto.visibility;
    if (dto.brandName              !== undefined) patch.brand_name                = dto.brandName ?? null;
    if (dto.modelNumber            !== undefined) patch.model_number              = dto.modelNumber ?? null;
    if (dto.keySpecs               !== undefined) patch.key_specs                 = dto.keySpecs ?? null;
    if (dto.trafficLightEnabled    !== undefined) patch.traffic_light_enabled     = dto.trafficLightEnabled;
    if (dto.trafficLightGreenPct   !== undefined) patch.traffic_light_green_pct   = dto.trafficLightGreenPct;
    if (dto.trafficLightYellowPct  !== undefined) patch.traffic_light_yellow_pct  = dto.trafficLightYellowPct;

    // Validate that effective end_time > effective start_time
    const effectiveStart = patch.start_time ?? auction.start_time;
    const effectiveEnd   = patch.end_time   ?? auction.end_time;
    if (effectiveStart && new Date(effectiveStart) <= new Date()) {
      throw new BadRequestException('Start time must be in the future');
    }
    if (effectiveStart && effectiveEnd && new Date(effectiveEnd) <= new Date(effectiveStart)) {
      throw new BadRequestException('End time must be after start time');
    }

    const updated = await this.auctionsRepository.updateFields(id, patch);

    this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_UPDATED',
      metadata: patch,
    });

    // Notify accepted vendors when a published auction is edited
    if (auction.status === AuctionStatus.PUBLISHED) {
      void this.notifyAcceptedVendors(id, auction.title);
    }

    return updated;
  }

  private async notifyAcceptedVendors(auctionId: string, auctionTitle: string): Promise<void> {
    const invitations = await this.vendorsService.findInvitationsByAuction(auctionId);
    for (const inv of invitations) {
      if (inv.status !== InvitationStatus.ACCEPTED) continue;
      const vendor = await this.vendorsService.findById(inv.vendor_id).catch(() => null);
      if (vendor?.user_id) {
        this.notificationsService.send(
          vendor.user_id,
          NotificationType.AUCTION_UPDATED,
          'An auction you joined has been updated',
          `"${auctionTitle}" has been updated by the buyer. Please review the changes.`,
          { auctionId },
        );
      }
    }
  }

  // ── State transitions ─────────────────────────────────────────────────────

  async publish(id: string, buyerId: string): Promise<AuctionRow> {
    const auction = await this.transition(id, buyerId, AuctionStatus.PUBLISHED, 'AUCTION_PUBLISHED');

    // Non-blocking: vendor shortlist runs in background after publish
    const categoryKeywords = auction.category
      ? auction.category.split(/[,\s]+/).filter(Boolean)
      : [];
    void this.agentsService.runVendorShortlist(auction.id, categoryKeywords);

    return auction;
  }

  async open(id: string, buyerId: string): Promise<AuctionRow> {
    return this.transition(id, buyerId, AuctionStatus.OPEN, 'AUCTION_OPENED');
  }

  async close(id: string, buyerId: string): Promise<AuctionRow> {
    const auction = await this.transition(id, buyerId, AuctionStatus.CLOSED, 'AUCTION_CLOSED');

    this.notificationsService.send(
      auction.buyer_id,
      NotificationType.AUCTION_CLOSED,
      `Auction "${auction.title}" has closed`,
      'The auction has ended. Review the results and issue the award.',
      { auctionId: auction.id },
    );

    // Non-blocking: award recommendation runs in the background
    this.agentsService.runAwardRecommendation(auction.id);

    return auction;
  }

  async pause(id: string, buyerId: string, reason?: string): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);

    if (auction.status !== AuctionStatus.OPEN) {
      throw new BadRequestException('Auction can only be paused when OPEN');
    }

    const updated = await this.auctionsRepository.updateStatus(id, AuctionStatus.PAUSED, {
      paused_at: new Date().toISOString(),
      paused_by: buyerId,
      pause_reason: reason ?? null,
    });

    this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_PAUSED',
      metadata: { reason },
    });

    this.realtimeService.emitAuctionPaused(id, reason);

    return updated;
  }

  async resume(id: string, buyerId: string): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);

    if (auction.status !== AuctionStatus.PAUSED) {
      throw new BadRequestException('Auction can only be resumed when PAUSED');
    }

    const updated = await this.auctionsRepository.updateStatus(id, AuctionStatus.OPEN, {
      resumed_at: new Date().toISOString(),
      resumed_by: buyerId,
    });

    this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_RESUMED',
    });

    this.realtimeService.emitAuctionResumed(id);

    return updated;
  }

  async award(id: string, buyerId: string, winningVendorId: string): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);
    this.assertTransitionAllowed(auction.status, AuctionStatus.AWARDED);
    const updated = await this.auctionsRepository.updateStatus(id, AuctionStatus.AWARDED, {
      winning_vendor_id: winningVendorId,
    });
    void this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_AWARDED',
      metadata: { winning_vendor_id: winningVendorId },
    });
    return updated;
  }

  async cancel(id: string, buyerId: string, reason: string): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);
    this.assertTransitionAllowed(auction.status, AuctionStatus.CANCELLED);

    const updated = await this.auctionsRepository.updateStatus(id, AuctionStatus.CANCELLED, {
      cancellation_reason: reason,
    });

    this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_CANCELLED',
      metadata: { reason },
    });

    return updated;
  }

  async clone(id: string, buyerId: string): Promise<AuctionRow> {
    const source = await this.findById(id, buyerId);

    const dto: CreateAuctionDto = {
      title: `${source.title} (Copy)`,
      description: source.description ?? undefined,
      category: source.category,
      quantity: source.quantity,
      unit: source.unit,
      type: source.type,
      ceilingPrice: source.ceiling_price,
      reservePrice: source.reserve_price ?? undefined,
      minDecrement: source.min_decrement,
      autoExtendEnabled: source.auto_extend_enabled,
      autoExtendMinutes: source.auto_extend_minutes,
      autoExtendTrigger: source.auto_extend_trigger,
      visibility: source.visibility,
    };

    return this.create(buyerId, dto);
  }

  // ── Lots ──────────────────────────────────────────────────────────────────

  async createLot(auctionId: string, buyerId: string, dto: CreateLotDto): Promise<LotRow> {
    const auction = await this.auctionsRepository.findById(auctionId);
    this.assertOwner(auction, buyerId);

    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Lots can only be added to DRAFT auctions');
    }

    return this.auctionsRepository.createLot(auctionId, dto);
  }

  async findLots(auctionId: string): Promise<LotRow[]> {
    await this.auctionsRepository.findById(auctionId); // existence check
    return this.auctionsRepository.findLotsByAuction(auctionId);
  }

  async updateLot(
    auctionId: string,
    lotId: string,
    buyerId: string,
    fields: Partial<Pick<LotRow, 'title' | 'quantity' | 'unit' | 'specifications'>>,
  ): Promise<LotRow> {
    const auction = await this.auctionsRepository.findById(auctionId);
    this.assertOwner(auction, buyerId);

    if (auction.status !== AuctionStatus.DRAFT) {
      throw new BadRequestException('Lots can only be updated on DRAFT auctions');
    }

    return this.auctionsRepository.updateLot(lotId, fields);
  }

  async delete(id: string, buyerId: string): Promise<void> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);

    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1_000);
    const isPublishedDeletable =
      auction.status === AuctionStatus.PUBLISHED &&
      auction.start_time != null &&
      new Date(auction.start_time) > oneHourFromNow;

    if (auction.status !== AuctionStatus.DRAFT && !isPublishedDeletable) {
      throw new UnprocessableEntityException(
        'Auctions can only be deleted when DRAFT, or PUBLISHED with start time more than 1 hour away',
      );
    }

    await this.auctionsRepository.delete(id);

    this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: 'AUCTION_DELETED',
    });
  }

  async extendByMinutes(id: string, buyerId: string, minutes: number): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    this.assertOwner(auction, buyerId);

    if (auction.status !== AuctionStatus.OPEN) {
      throw new UnprocessableEntityException('Only OPEN auctions can be extended');
    }

    const base = auction.end_time ? new Date(auction.end_time) : new Date();
    const newEndTime = new Date(base.getTime() + minutes * 60_000).toISOString();
    return this.extendEndTime(id, newEndTime);
  }

  async extendEndTime(auctionId: string, newEndTime: string): Promise<AuctionRow> {
    const updated = await this.auctionsRepository.updateStatus(auctionId, AuctionStatus.OPEN, {
      end_time: newEndTime,
    });

    this.auditService.log({
      auctionId,
      actorId: 'system',
      actorType: ActorType.SYSTEM,
      action: 'AUCTION_AUTO_EXTENDED',
      metadata: { newEndTime },
    });

    return updated;
  }

  // ── Audit trail ───────────────────────────────────────────────────────────

  findAuditLogs(auctionId: string): Promise<AuditLogRow[]> {
    return this.auctionsRepository.findAuditLogs(auctionId);
  }

  async exportAuditCsv(auctionId: string): Promise<string> {
    const logs = await this.auctionsRepository.findAuditLogs(auctionId);

    const header = 'id,auction_id,actor_id,actor_type,action,metadata,created_at';
    const rows = logs.map((l) =>
      [
        l.id,
        l.auction_id ?? '',
        l.actor_id ?? '',
        l.actor_type ?? '',
        `"${l.action}"`,
        `"${JSON.stringify(l.metadata ?? {}).replace(/"/g, '""')}"`,
        l.created_at,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ── Scheduler callbacks ───────────────────────────────────────────────────

  /**
   * Called by AuctionsScheduler every minute.
   * Transitions PUBLISHED auctions whose start_time has passed to OPEN.
   */
  async autoOpenDueAuctions(): Promise<void> {
    const now = new Date().toISOString();
    const due = await this.auctionsRepository.findByStatusAndTime(
      AuctionStatus.PUBLISHED,
      'start_time',
      now,
    );

    for (const auction of due) {
      try {
        await this.auctionsRepository.updateStatus(auction.id, AuctionStatus.OPEN);

        this.auditService.log({
          auctionId: auction.id,
          actorId: 'system',
          actorType: ActorType.SYSTEM,
          action: 'AUCTION_AUTO_OPENED',
        });

        // Notify all invited vendors
        const invitations = await this.vendorsService.findInvitationsByAuction(auction.id);
        for (const inv of invitations) {
          const vendor = await this.vendorsService.findById(inv.vendor_id).catch(() => null);
          if (vendor?.user_id) {
            this.notificationsService.send(
              vendor.user_id,
              NotificationType.AUCTION_OPEN,
              `Auction "${auction.title}" is now open`,
              undefined,
              { auctionId: auction.id },
            );
          }
        }
      } catch {
        // Log but continue — one failure must not block other auctions
      }
    }
  }

  /**
   * Called by AuctionsScheduler every minute.
   * Transitions OPEN auctions whose end_time has passed to CLOSED.
   */
  async autoCloseDueAuctions(): Promise<void> {
    const now = new Date().toISOString();
    const due = await this.auctionsRepository.findByStatusAndTime(
      AuctionStatus.OPEN,
      'end_time',
      now,
    );

    for (const auction of due) {
      try {
        await this.auctionsRepository.updateStatus(auction.id, AuctionStatus.CLOSED);

        this.auditService.log({
          auctionId: auction.id,
          actorId: 'system',
          actorType: ActorType.SYSTEM,
          action: 'AUCTION_AUTO_CLOSED',
        });

        this.notificationsService.send(
          auction.buyer_id,
          NotificationType.AUCTION_CLOSED,
          `Auction "${auction.title}" has closed`,
          'The auction has ended automatically. Review the results and issue the award.',
          { auctionId: auction.id },
        );

        // Non-blocking: award recommendation
        this.agentsService.runAwardRecommendation(auction.id);
      } catch {
        // Log but continue
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async transition(
    id: string,
    buyerId: string,
    targetStatus: AuctionStatus,
    auditAction: string,
  ): Promise<AuctionRow> {
    const auction = await this.auctionsRepository.findById(id);
    if (!auction) throw new NotFoundException(`Auction ${id} not found`);

    this.assertOwner(auction, buyerId);
    this.assertTransitionAllowed(auction.status, targetStatus);

    const updated = await this.auctionsRepository.updateStatus(id, targetStatus);

    this.auditService.log({
      auctionId: id,
      actorId: buyerId,
      actorType: ActorType.BUYER,
      action: auditAction,
    });

    return updated;
  }

  private assertOwner(auction: AuctionRow, buyerId: string): void {
    if (auction.buyer_id !== buyerId) {
      throw new ForbiddenException('You do not own this auction');
    }
  }

  private assertTransitionAllowed(current: AuctionStatus, target: AuctionStatus): void {
    if (!VALID_TRANSITIONS[current]?.includes(target)) {
      throw new UnprocessableEntityException(
        `Cannot transition auction from ${current} to ${target}`,
      );
    }
  }
}
