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
import {
  AuctionStatus,
  ActorType,
  NotificationType,
} from '../common/types';
import type { CreateAuctionDto } from './dto/create-auction.dto';
import type { CreateLotDto } from './dto/create-lot.dto';

/** Valid forward-only state transitions. CANCELLED is allowed from any state. */
const VALID_TRANSITIONS: Record<AuctionStatus, AuctionStatus[]> = {
  [AuctionStatus.DRAFT]: [AuctionStatus.PUBLISHED, AuctionStatus.CANCELLED],
  [AuctionStatus.PUBLISHED]: [AuctionStatus.OPEN, AuctionStatus.CANCELLED],
  [AuctionStatus.OPEN]: [AuctionStatus.CLOSED, AuctionStatus.CANCELLED],
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
  ) {}

  async create(buyerId: string, dto: CreateAuctionDto): Promise<AuctionRow> {
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

  // ── State transitions ─────────────────────────────────────────────────────

  async publish(id: string, buyerId: string): Promise<AuctionRow> {
    return this.transition(id, buyerId, AuctionStatus.PUBLISHED, 'AUCTION_PUBLISHED');
  }

  async open(id: string, buyerId: string): Promise<AuctionRow> {
    return this.transition(id, buyerId, AuctionStatus.OPEN, 'AUCTION_OPENED');
  }

  async close(id: string, buyerId: string): Promise<AuctionRow> {
    const auction = await this.transition(id, buyerId, AuctionStatus.CLOSED, 'AUCTION_CLOSED');

    // Non-blocking: award recommendation runs in the background
    this.agentsService.runAwardRecommendation(auction.id);

    return auction;
  }

  async award(id: string, buyerId: string): Promise<AuctionRow> {
    return this.transition(id, buyerId, AuctionStatus.AWARDED, 'AUCTION_AWARDED');
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
