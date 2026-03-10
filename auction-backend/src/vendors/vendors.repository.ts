import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { VendorStatus, InvitationStatus } from '../common/types';

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

export interface InvitationRow {
  id: string;
  auction_id: string;
  vendor_id: string;
  status: InvitationStatus;
  invited_at: string;
  responded_at: string | null;
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

@Injectable()
export class VendorsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAuctionStatus(auctionId: string): Promise<string | null> {
    const { data } = await this.db
      .getClient()
      .from('auctions')
      .select('status')
      .eq('id', auctionId)
      .single();
    return (data as { status: string } | null)?.status ?? null;
  }

  async findAllApproved(): Promise<VendorRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('vendors')
      .select('*')
      .eq('status', VendorStatus.APPROVED)
      .order('company_name');

    if (error) throw new InternalServerErrorException('Failed to fetch vendors');
    return (data ?? []) as VendorRow[];
  }

  async findById(id: string): Promise<VendorWithPerformance> {
    const { data: vendor, error } = await this.db
      .getClient()
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !vendor) throw new NotFoundException(`Vendor ${id} not found`);

    const { data: scores } = await this.db
      .getClient()
      .from('vendor_performance_scores')
      .select('category, delivery_success_rate, quality_score, total_contracts, defaulted_contracts')
      .eq('vendor_id', id);

    const { data: flags } = await this.db
      .getClient()
      .from('vendor_flags')
      .select('flag_type, flag_reason, expires_at')
      .eq('vendor_id', id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    return {
      ...(vendor as VendorRow),
      performance_scores: (scores ?? []) as VendorWithPerformance['performance_scores'],
      active_flags: (flags ?? []) as VendorWithPerformance['active_flags'],
    };
  }

  async findByUserId(userId: string): Promise<VendorRow | null> {
    const { data } = await this.db
      .getClient()
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .single();

    return (data as VendorRow | null) ?? null;
  }

  async findUserIdByVendorId(vendorId: string): Promise<string | null> {
    const { data } = await this.db
      .getClient()
      .from('vendors')
      .select('user_id')
      .eq('id', vendorId)
      .single();

    return (data as { user_id: string | null } | null)?.user_id ?? null;
  }

  async updateProfile(
    id: string,
    fields: { company_name?: string; contact_name?: string; category_tags?: string[] },
  ): Promise<VendorRow> {
    const { data, error } = await this.db
      .getClient()
      .from('vendors')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to update vendor profile');
    }
    return data as VendorRow;
  }

  // ── Invitations ──────────────────────────────────────────────────────────

  async createInvitations(auctionId: string, vendorIds: string[]): Promise<void> {
    const rows = vendorIds.map((vendorId) => ({
      auction_id: auctionId,
      vendor_id: vendorId,
      status: InvitationStatus.INVITED,
    }));

    const { error } = await this.db
      .getClient()
      .from('vendor_invitations')
      .upsert(rows, { onConflict: 'auction_id,vendor_id', ignoreDuplicates: true });

    if (error) throw new InternalServerErrorException('Failed to create invitations');
  }

  async findInvitationsByAuction(auctionId: string): Promise<InvitationRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('vendor_invitations')
      .select('*')
      .eq('auction_id', auctionId);

    if (error) throw new InternalServerErrorException('Failed to fetch invitations');
    return (data ?? []) as InvitationRow[];
  }

  async revokeInvitation(auctionId: string, vendorId: string): Promise<void> {
    const { error } = await this.db
      .getClient()
      .from('vendor_invitations')
      .delete()
      .eq('auction_id', auctionId)
      .eq('vendor_id', vendorId);

    if (error) throw new InternalServerErrorException('Failed to revoke invitation');
  }

  async findInvitationsByVendor(vendorId: string): Promise<InvitationRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('vendor_invitations')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('invited_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch invitations');
    return (data ?? []) as InvitationRow[];
  }

  async findInvitation(id: string): Promise<InvitationRow | null> {
    const { data } = await this.db
      .getClient()
      .from('vendor_invitations')
      .select('*')
      .eq('id', id)
      .single();

    return (data as InvitationRow | null) ?? null;
  }

  async updateInvitationStatus(
    id: string,
    status: InvitationStatus,
  ): Promise<InvitationRow> {
    const { data, error } = await this.db
      .getClient()
      .from('vendor_invitations')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to update invitation');
    }
    return data as InvitationRow;
  }

  async verifyInvitationAccepted(auctionId: string, vendorId: string): Promise<boolean> {
    const { data } = await this.db
      .getClient()
      .from('vendor_invitations')
      .select('id')
      .eq('auction_id', auctionId)
      .eq('vendor_id', vendorId)
      .eq('status', InvitationStatus.ACCEPTED)
      .single();

    return data !== null;
  }
}
