import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export function createAwardRecommendationTools(db: SupabaseClient): DynamicStructuredTool[] {
  const getFinalBidLeaderboard = new DynamicStructuredTool({
    name: 'get_final_bid_leaderboard',
    description: 'Returns the ranked final bids for a closed auction.',
    schema: z.object({ auctionId: z.string() }),
    func: async ({ auctionId }) => {
      const { data: auction } = await db
        .from('auctions')
        .select('type')
        .eq('id', auctionId)
        .single();

      const { data: bids } = await db
        .from('bids')
        .select('vendor_id, amount, submitted_at')
        .eq('auction_id', auctionId)
        .eq('status', 'ACCEPTED');

      type Bid = { vendor_id: string; amount: number; submitted_at: string };
      const allBids = (bids ?? []) as Bid[];

      // Best bid per vendor
      const bestByVendor: Record<string, Bid> = {};
      for (const bid of allBids) {
        const existing = bestByVendor[bid.vendor_id];
        const isBetter = auction?.type === 'FORWARD'
          ? !existing || bid.amount > existing.amount
          : !existing || bid.amount < existing.amount;
        if (isBetter) bestByVendor[bid.vendor_id] = bid;
      }

      const ranked = Object.values(bestByVendor).sort((a, b) =>
        auction?.type === 'FORWARD' ? b.amount - a.amount : a.amount - b.amount,
      );

      return JSON.stringify({ leaderboard: ranked.map((b, i) => ({ ...b, rank: i + 1 })) });
    },
  });

  const getVendorPerformanceSummary = new DynamicStructuredTool({
    name: 'get_vendor_performance_summary',
    description: 'Returns delivery rates, quality scores, and default history for given vendor IDs.',
    schema: z.object({ vendorIds: z.array(z.string()) }),
    func: async ({ vendorIds }) => {
      const { data: scores } = await db
        .from('vendor_performance_scores')
        .select('*')
        .in('vendor_id', vendorIds);

      const { data: vendors } = await db
        .from('vendors')
        .select('id, company_name, status')
        .in('id', vendorIds);

      return JSON.stringify({ performance: scores ?? [], vendors: vendors ?? [] });
    },
  });

  const getAuctionAnomalyFlags = new DynamicStructuredTool({
    name: 'get_auction_anomaly_flags',
    description: 'Returns all anomaly alerts raised during this auction.',
    schema: z.object({ auctionId: z.string() }),
    func: async ({ auctionId }) => {
      const { data } = await db
        .from('auction_alerts')
        .select('alert_type, severity, description, vendor_ids_involved, created_at')
        .eq('auction_id', auctionId)
        .order('created_at');

      return JSON.stringify({ alerts: data ?? [] });
    },
  });

  const getAuctionAiMetadata = new DynamicStructuredTool({
    name: 'get_auction_ai_metadata',
    description: 'Returns the price intelligence output (risk threshold, ceiling suggestion) for this auction.',
    schema: z.object({ auctionId: z.string() }),
    func: async ({ auctionId }) => {
      const { data } = await db
        .from('auction_ai_metadata')
        .select('*')
        .eq('auction_id', auctionId)
        .single();

      return JSON.stringify(data ?? { message: 'No AI metadata found' });
    },
  });

  return [getFinalBidLeaderboard, getVendorPerformanceSummary, getAuctionAnomalyFlags, getAuctionAiMetadata];
}
