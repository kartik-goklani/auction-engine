import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import type { AuctionStatus, AuctionType, AuctionVisibility } from '../common/types';
import { AUCTION_DEFAULTS } from '../common/constants';
import type { CreateAuctionDto } from './dto/create-auction.dto';
import type { CreateLotDto } from './dto/create-lot.dto';

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
  ceiling_price: number;
  reserve_price: number | null;
  min_decrement: number;
  auto_extend_enabled: boolean;
  auto_extend_minutes: number;
  auto_extend_trigger: number;
  visibility: AuctionVisibility;
  cancellation_reason: string | null;
  winning_vendor_id: string | null;
  brand_name: string | null;
  model_number: string | null;
  key_specs: string | null;
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
  actor_type: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

@Injectable()
export class AuctionsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(buyerId: string, dto: CreateAuctionDto): Promise<AuctionRow> {
    const { data, error } = await this.db
      .getClient()
      .from('auctions')
      .insert({
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category,
        quantity: dto.quantity,
        unit: dto.unit,
        type: dto.type,
        buyer_id: buyerId,
        start_time: dto.startTime ?? null,
        end_time: dto.endTime ?? null,
        ceiling_price: dto.ceilingPrice,
        reserve_price: dto.reservePrice ?? null,
        min_decrement: dto.minDecrement ?? AUCTION_DEFAULTS.MIN_DECREMENT,
        auto_extend_enabled: dto.autoExtendEnabled ?? AUCTION_DEFAULTS.AUTO_EXTEND_ENABLED,
        auto_extend_minutes: dto.autoExtendMinutes ?? AUCTION_DEFAULTS.AUTO_EXTEND_MINUTES,
        auto_extend_trigger: dto.autoExtendTrigger ?? AUCTION_DEFAULTS.AUTO_EXTEND_TRIGGER_MINUTES,
        visibility: dto.visibility ?? AUCTION_DEFAULTS.VISIBILITY,
        brand_name: dto.brandName ?? null,
        model_number: dto.modelNumber ?? null,
        key_specs: dto.keySpecs ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        `Failed to create auction: ${error?.message ?? 'no data returned'} (code: ${error?.code ?? 'none'})`,
      );
    }
    return data as AuctionRow;
  }

  async findByBuyer(buyerId: string): Promise<AuctionRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('auctions')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch auctions');
    return (data ?? []) as AuctionRow[];
  }

  async findById(id: string): Promise<AuctionRow> {
    const { data, error } = await this.db
      .getClient()
      .from('auctions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Auction ${id} not found`);
    return data as AuctionRow;
  }

  async updateStatus(
    id: string,
    status: AuctionStatus,
    extra: Partial<Pick<AuctionRow, 'cancellation_reason' | 'end_time' | 'winning_vendor_id'>> = {},
  ): Promise<AuctionRow> {
    const { data, error } = await this.db
      .getClient()
      .from('auctions')
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to update auction status');
    }
    return data as AuctionRow;
  }

  async updateFields(
    id: string,
    fields: Partial<Pick<AuctionRow,
      'title' | 'description' | 'category' | 'start_time' | 'end_time' |
      'quantity' | 'unit' | 'ceiling_price' | 'reserve_price' | 'min_decrement' |
      'auto_extend_enabled' | 'auto_extend_minutes' | 'auto_extend_trigger' | 'visibility'
    >>,
  ): Promise<AuctionRow> {
    const { data, error } = await this.db
      .getClient()
      .from('auctions')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to update auction');
    }
    return data as AuctionRow;
  }

  async findByStatusAndTime(
    status: AuctionStatus,
    timeField: 'start_time' | 'end_time',
    before: string,
  ): Promise<AuctionRow[]> {
    const { data } = await this.db
      .getClient()
      .from('auctions')
      .select('*')
      .eq('status', status)
      .lte(timeField, before);

    return (data ?? []) as AuctionRow[];
  }

  // ── Lots ──────────────────────────────────────────────────────────────────

  async createLot(auctionId: string, dto: CreateLotDto): Promise<LotRow> {
    const { data, error } = await this.db
      .getClient()
      .from('lots')
      .insert({
        auction_id: auctionId,
        title: dto.title,
        quantity: dto.quantity,
        unit: dto.unit,
        specifications: dto.specifications ?? null,
      })
      .select()
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to create lot');
    return data as LotRow;
  }

  async findLotsByAuction(auctionId: string): Promise<LotRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('lots')
      .select('*')
      .eq('auction_id', auctionId);

    if (error) throw new InternalServerErrorException('Failed to fetch lots');
    return (data ?? []) as LotRow[];
  }

  async updateLot(
    lotId: string,
    fields: Partial<Pick<LotRow, 'title' | 'quantity' | 'unit' | 'specifications'>>,
  ): Promise<LotRow> {
    const { data, error } = await this.db
      .getClient()
      .from('lots')
      .update(fields)
      .eq('id', lotId)
      .select()
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to update lot');
    return data as LotRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .getClient()
      .from('auctions')
      .delete()
      .eq('id', id);

    if (error) throw new InternalServerErrorException('Failed to delete auction');
  }

  // ── Audit trail ───────────────────────────────────────────────────────────

  async findAuditLogs(auctionId: string): Promise<AuditLogRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('audit_logs')
      .select('*')
      .eq('auction_id', auctionId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch audit logs');
    return (data ?? []) as AuditLogRow[];
  }
}
