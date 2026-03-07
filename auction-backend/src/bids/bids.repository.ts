import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import type { BidStatus, BidRejectionReason } from '../common/types';

export interface BidRow {
  id: string;
  auction_id: string;
  vendor_id: string;
  amount: number;
  status: BidStatus;
  rejection_reason: BidRejectionReason | null;
  submitted_at: string;
}

export interface BidRpcResult {
  id: string;
  auction_id: string;
  vendor_id: string;
  amount: number;
  status: string;
  rejection_reason: string | null;
  submitted_at: string;
}

@Injectable()
export class BidsRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Submits a bid via the accept_bid_transaction PostgreSQL RPC.
   * All five validation checks run atomically inside the DB function
   * with SELECT FOR UPDATE on the auction row.
   */
  async submitBidTransactional(
    auctionId: string,
    vendorId: string,
    amount: number,
  ): Promise<BidRpcResult> {
    const { data, error } = await this.db
      .getClient()
      .rpc('accept_bid_transaction', {
        p_auction_id: auctionId,
        p_vendor_id: vendorId,
        p_amount: amount,
      });

    if (error) {
      throw new InternalServerErrorException(`Bid transaction failed: ${error.message}`);
    }

    const rows = data as BidRpcResult[] | null;
    if (!rows || rows.length === 0) {
      throw new InternalServerErrorException('Bid transaction returned no result');
    }

    return rows[0];
  }

  async findByAuction(auctionId: string): Promise<BidRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .order('submitted_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch bids');
    return (data ?? []) as BidRow[];
  }

  async findByVendorAndAuction(vendorId: string, auctionId: string): Promise<BidRow[]> {
    const { data, error } = await this.db
      .getClient()
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('vendor_id', vendorId)
      .order('submitted_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch bids');
    return (data ?? []) as BidRow[];
  }

  async getBestBid(
    auctionId: string,
    auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID',
  ): Promise<BidRow | null> {
    const order = auctionType === 'FORWARD' ? false : true; // REVERSE: ascending (lowest first)
    const { data } = await this.db
      .getClient()
      .from('bids')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('status', 'ACCEPTED')
      .order('amount', { ascending: order })
      .limit(1)
      .single();

    return (data as BidRow | null) ?? null;
  }

  async getAcceptedBidCount(auctionId: string): Promise<number> {
    const { count } = await this.db
      .getClient()
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', auctionId)
      .eq('status', 'ACCEPTED');

    return count ?? 0;
  }

  /** Returns ranks as: Map<vendorId, rank> */
  async getVendorRanks(auctionId: string, auctionType: string): Promise<Map<string, number>> {
    const ascending = auctionType !== 'FORWARD';
    const { data } = await this.db
      .getClient()
      .from('bids')
      .select('vendor_id, amount')
      .eq('auction_id', auctionId)
      .eq('status', 'ACCEPTED')
      .order('amount', { ascending });

    const ranks = new Map<string, number>();
    const seen = new Set<string>();
    let rank = 1;

    for (const row of (data ?? []) as { vendor_id: string; amount: number }[]) {
      if (!seen.has(row.vendor_id)) {
        seen.add(row.vendor_id);
        ranks.set(row.vendor_id, rank++);
      }
    }

    return ranks;
  }
}
