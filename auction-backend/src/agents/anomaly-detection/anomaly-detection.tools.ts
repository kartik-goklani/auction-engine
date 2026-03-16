import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates the 4 Tier 2 anomaly detection tools.
 *
 * auctionId and agentRunId are captured as closure context so the LLM
 * cannot corrupt them via tool arguments.
 */
export function createAnomalyDetectionTools(
  db: SupabaseClient,
  auctionId: string,
  agentRunId: string,
): DynamicStructuredTool[] {

  // ── TOOL 1: get_vendor_bid_history ────────────────────────────────────────

  const getVendorBidHistory = new DynamicStructuredTool({
    name: 'get_vendor_bid_history',
    description:
      'Get the complete bid timeline for a specific vendor in this auction. Returns all accepted bids with inter-bid intervals. Use this to investigate SCRIPTED_BIDDING or EXTREME_DROP flags.',
    schema: z.object({
      vendorId: z.string().describe('The vendor ID to look up'),
    }),
    func: async ({ vendorId }) => {
      const { data } = await db
        .from('bids')
        .select('id, amount, submitted_at')
        .eq('auction_id', auctionId)
        .eq('vendor_id', vendorId)
        .eq('status', 'ACCEPTED')
        .order('submitted_at', { ascending: true });

      type BidRow = { id: string; amount: number; submitted_at: string };
      const bids = (data ?? []) as BidRow[];

      const annotated = bids.map((bid, i) => ({
        bidId:       bid.id,
        amount:      bid.amount,
        amountRupees: (bid.amount / 100).toFixed(2),
        submittedAt: bid.submitted_at,
        gap_ms:      i > 0
          ? new Date(bid.submitted_at).getTime() - new Date(bids[i - 1].submitted_at).getTime()
          : null,
      }));

      return JSON.stringify({ vendorId, bids: annotated });
    },
  });

  // ── TOOL 2: get_vendor_flag_history ──────────────────────────────────────

  const getVendorFlagHistory = new DynamicStructuredTool({
    name: 'get_vendor_flag_history',
    description:
      'Get all past anomaly alerts raised for a specific vendor across all auctions. Use this to determine if this vendor has a prior pattern of suspicious behaviour.',
    schema: z.object({
      vendorId: z.string().describe('The vendor ID to look up'),
    }),
    func: async ({ vendorId }) => {
      const { data } = await db
        .from('auction_alerts')
        .select('alert_type, severity, auction_id, created_at')
        .contains('vendor_ids_involved', [vendorId])
        .order('created_at', { ascending: false })
        .limit(20);

      type AlertRow = {
        alert_type: string;
        severity: string;
        auction_id: string;
        created_at: string;
      };
      const alerts = (data ?? []) as AlertRow[];

      return JSON.stringify({
        vendorId,
        totalAlerts: alerts.length,
        alerts: alerts.map((a) => ({
          alertType:  a.alert_type,
          severity:   a.severity,
          auctionId:  a.auction_id,
          createdAt:  a.created_at,
        })),
      });
    },
  });

  // ── TOOL 3: get_vendor_pair_co_auctions ──────────────────────────────────

  const getVendorPairCoAuctions = new DynamicStructuredTool({
    name: 'get_vendor_pair_co_auctions',
    description:
      'Get the number of auctions where two specific vendors both participated, and whether they have been flagged together before. Use this only when investigating COORDINATED_TIMING flags involving two specific vendors.',
    schema: z.object({
      vendorId1: z.string().describe('First vendor ID'),
      vendorId2: z.string().describe('Second vendor ID'),
    }),
    func: async ({ vendorId1, vendorId2 }) => {
      // Count auctions where both vendors had ACCEPTED invitations
      const { count: coAuctionCount } = await db
        .from('vendor_invitations')
        .select('auction_id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId1)
        .eq('status', 'ACCEPTED')
        .in(
          'auction_id',
          // Subquery via a separate fetch
          await db
            .from('vendor_invitations')
            .select('auction_id')
            .eq('vendor_id', vendorId2)
            .eq('status', 'ACCEPTED')
            .then(({ data }) => (data ?? []).map((r: { auction_id: string }) => r.auction_id)),
        );

      // Count alerts where both vendor IDs appear in vendor_ids_involved
      const { count: sharedFlagCount } = await db
        .from('auction_alerts')
        .select('id', { count: 'exact', head: true })
        .contains('vendor_ids_involved', [vendorId1, vendorId2]);

      return JSON.stringify({
        vendorId1,
        vendorId2,
        coAuctionCount: coAuctionCount ?? 0,
        sharedFlagCount: sharedFlagCount ?? 0,
      });
    },
  });

  // ── TOOL 4: raise_alert ──────────────────────────────────────────────────

  const raiseAlert = new DynamicStructuredTool({
    name: 'raise_alert',
    description:
      'Raise a verified anomaly alert. Call this ONLY when you have investigated the flags and are confident this is a genuine alert worth showing the buyer. Do NOT call this for false positives or ambiguous patterns. You may call this once per distinct anomaly type if multiple types are confirmed.',
    schema: z.object({
      alertType: z
        .string()
        .describe('Must match one of the alert_type enum values: EXTREME_DROP, SCRIPTED_BIDDING, IDENTICAL_AMOUNTS, COORDINATED_TIMING, BELOW_RISK_THRESHOLD, COLLUSION_SIGNAL, BELOW_RISK_BID'),
      severity: z
        .enum(['LOW', 'MEDIUM', 'HIGH'])
        .describe('Severity level of the alert'),
      description: z
        .string()
        .describe('Max 2 sentences written for a procurement buyer. Use ₹ rupee amounts, not paise.'),
      vendorIdsInvolved: z
        .array(z.string())
        .default([])
        .describe('IDs of vendors involved in this anomaly'),
    }),
    func: async ({ alertType, severity, description, vendorIdsInvolved }) => {
      const { data, error } = await db
        .from('auction_alerts')
        .insert({
          auction_id:          auctionId,
          agent_run_id:        agentRunId,
          alert_type:          alertType,
          severity,
          description,
          vendor_ids_involved: vendorIdsInvolved,
        })
        .select('id, alert_type, severity')
        .single();

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }

      return JSON.stringify({
        success:   true,
        alertId:   (data as { id: string }).id,
        alertType: (data as { alert_type: string }).alert_type,
        severity:  (data as { severity: string }).severity,
      });
    },
  });

  return [getVendorBidHistory, getVendorFlagHistory, getVendorPairCoAuctions, raiseAlert];
}
