import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ANOMALY, AGENT_QUERY } from '../../common/constants';
import { SupabaseClient } from '@supabase/supabase-js';

export function createAnomalyDetectionTools(db: SupabaseClient): DynamicStructuredTool[] {
  const getRecentBidsForAuction = new DynamicStructuredTool({
    name: 'get_recent_bids_for_auction',
    description: 'Returns the last N accepted bids for an auction with timing information.',
    schema: z.object({
      auctionId: z.string(),
      limit: z.number().int().min(1).max(AGENT_QUERY.MAX_LIMIT).default(AGENT_QUERY.DEFAULT_LIMIT),
    }),
    func: async ({ auctionId, limit }) => {
      const { data } = await db
        .from('bids')
        .select('id, vendor_id, amount, submitted_at')
        .eq('auction_id', auctionId)
        .eq('status', 'ACCEPTED')
        .order('submitted_at', { ascending: false })
        .limit(limit);

      type Bid = { vendor_id: string; amount: number; submitted_at: string };
      const bids = (data ?? []) as Bid[];

      // Annotate with gap_ms between consecutive bids
      const annotated = bids.map((bid, i) => ({
        ...bid,
        gap_ms:
          i < bids.length - 1
            ? new Date(bids[i].submitted_at).getTime() -
              new Date(bids[i + 1].submitted_at).getTime()
            : null,
      }));

      return JSON.stringify({ bids: annotated });
    },
  });

  const analyseBidTimingPattern = new DynamicStructuredTool({
    name: 'analyse_bid_timing_pattern',
    description:
      'Analyses bid timing patterns to detect rapid alternating pairs (collusion signal) or suspiciously low bids.',
    schema: z.object({
      bids: z
        .array(
          z.object({
            vendor_id: z.string(),
            amount: z.number(),
            submitted_at: z.string(),
            gap_ms: z.number().nullable(),
          }),
        )
        .describe('Bid array from get_recent_bids_for_auction'),
      riskThresholdPaise: z.number().int().describe('Risk threshold from Agent 1 output'),
    }),
    func: async ({ bids, riskThresholdPaise }) => {
      if (bids.length < ANOMALY.COLLUSION_MIN_BIDS) {
        return JSON.stringify({
          anomaly_detected: false,
          reason: 'Insufficient bids to detect pattern',
        });
      }

      // Detect rapid alternating pairs — classic collusion signal
      // Two vendors alternating bids within 3 seconds of each other
      const RAPID_MS = ANOMALY.COLLUSION_RAPID_WINDOW_MS;
      let collusionPairsFound = 0;
      const suspectedVendors: string[] = [];

      for (let i = 0; i < bids.length - 3; i++) {
        const a = bids[i];
        const b = bids[i + 1];
        const c = bids[i + 2];
        const d = bids[i + 3];

        if (
          a.vendor_id !== b.vendor_id &&
          a.vendor_id === c.vendor_id &&
          b.vendor_id === d.vendor_id &&
          (a.gap_ms ?? Infinity) < RAPID_MS &&
          (b.gap_ms ?? Infinity) < RAPID_MS
        ) {
          collusionPairsFound++;
          suspectedVendors.push(a.vendor_id, b.vendor_id);
        }
      }

      // Detect below-risk bids
      const belowRiskBids = bids.filter((b) => b.amount < riskThresholdPaise);

      const collusionDetected = collusionPairsFound >= ANOMALY.COLLUSION_MIN_PAIRS;
      const belowRiskDetected = belowRiskBids.length > 0;

      if (!collusionDetected && !belowRiskDetected) {
        return JSON.stringify({ anomaly_detected: false });
      }

      return JSON.stringify({
        anomaly_detected: true,
        collusion_detected: collusionDetected,
        below_risk_detected: belowRiskDetected,
        suspected_vendor_ids: [...new Set(suspectedVendors)],
        below_risk_vendor_ids: belowRiskBids.map((b) => b.vendor_id),
        pattern_occurrences: collusionPairsFound,
      });
    },
  });

  const getRiskThresholdForAuction = new DynamicStructuredTool({
    name: 'get_risk_threshold_for_auction',
    description: 'Fetches the risk threshold set by the Price Intelligence agent for this auction.',
    schema: z.object({
      auctionId: z.string(),
    }),
    func: async ({ auctionId }) => {
      const { data } = await db
        .from('auction_ai_metadata')
        .select('risk_threshold, risk_note, confidence_level')
        .eq('auction_id', auctionId)
        .single();

      if (!data) {
        return JSON.stringify({
          risk_threshold: null,
          message: 'No AI metadata found — Price Intelligence agent may not have run',
        });
      }
      return JSON.stringify(data);
    },
  });

  const createAnomalyAlert = new DynamicStructuredTool({
    name: 'create_anomaly_alert',
    description: 'Creates an anomaly alert in the database when a signal is detected.',
    schema: z.object({
      auctionId: z.string(),
      agentRunId: z.string(),
      alertType: z.enum(['COLLUSION_SIGNAL', 'BELOW_RISK_BID']),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
      description: z.string(),
      vendorIdsInvolved: z.array(z.string()).default([]),
    }),
    func: async ({ auctionId, agentRunId, alertType, severity, description, vendorIdsInvolved }) => {
      const { data, error } = await db
        .from('auction_alerts')
        .insert({
          auction_id: auctionId,
          agent_run_id: agentRunId,
          alert_type: alertType,
          severity,
          description,
          vendor_ids_involved: vendorIdsInvolved,
        })
        .select()
        .single();

      if (error) {
        return JSON.stringify({ success: false, error: error.message });
      }
      return JSON.stringify({ success: true, alert: data });
    },
  });

  return [getRecentBidsForAuction, analyseBidTimingPattern, getRiskThresholdForAuction, createAnomalyAlert];
}
