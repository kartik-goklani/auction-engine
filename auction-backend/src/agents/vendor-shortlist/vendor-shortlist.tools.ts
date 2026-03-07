import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export function createVendorShortlistTools(db: SupabaseClient): DynamicStructuredTool[] {
  const getVendorsByCategory = new DynamicStructuredTool({
    name: 'get_vendors_by_category',
    description: 'Returns approved vendors whose category_tags match the provided keywords.',
    schema: z.object({
      categoryKeywords: z
        .array(z.string())
        .describe('Keywords to match against vendor category tags'),
    }),
    func: async ({ categoryKeywords }) => {
      const { data } = await db
        .from('vendors')
        .select('id, company_name, contact_name, email, category_tags, status')
        .eq('status', 'APPROVED')
        .overlaps('category_tags', categoryKeywords);

      return JSON.stringify({ vendors: data ?? [] });
    },
  });

  const getVendorCapacityFlags = new DynamicStructuredTool({
    name: 'get_vendor_capacity_flags',
    description: 'Returns active LOW_CAPACITY and SUSPENDED flags for the specified vendor IDs.',
    schema: z.object({
      vendorIds: z.array(z.string()).describe('Vendor IDs to check for active flags'),
    }),
    func: async ({ vendorIds }) => {
      const now = new Date().toISOString();
      const { data } = await db
        .from('vendor_flags')
        .select('vendor_id, flag_type, flag_reason, expires_at')
        .in('vendor_id', vendorIds)
        .in('flag_type', ['LOW_CAPACITY', 'SUSPENDED'])
        .or(`expires_at.is.null,expires_at.gt.${now}`);

      return JSON.stringify({ flags: data ?? [] });
    },
  });

  const getVendorAuctionHistory = new DynamicStructuredTool({
    name: 'get_vendor_auction_history',
    description: 'Returns win/participate/delivery history for the specified vendor IDs.',
    schema: z.object({
      vendorIds: z.array(z.string()).describe('Vendor IDs to fetch auction history for'),
    }),
    func: async ({ vendorIds }) => {
      const { data: scores } = await db
        .from('vendor_performance_scores')
        .select(
          'vendor_id, category, delivery_success_rate, quality_score, total_contracts, defaulted_contracts',
        )
        .in('vendor_id', vendorIds);

      return JSON.stringify({ performance_scores: scores ?? [] });
    },
  });

  return [getVendorsByCategory, getVendorCapacityFlags, getVendorAuctionHistory];
}
