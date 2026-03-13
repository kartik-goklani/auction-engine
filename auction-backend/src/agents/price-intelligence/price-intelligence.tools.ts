import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AGENT_QUERY, PRICE_INTELLIGENCE } from '../../common/constants';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuctionType } from '../../common/types';
import { buildHistoricalAuctionResults } from './price-intelligence.helpers';
import { searchSerper, type SerperSearchConfig } from '../../common/lib/serper.client';
import { extractWebEvidenceSignals } from './price-intelligence.web';
import type { ProcurementContext } from './price-intelligence.context';

export function createPriceIntelligenceTools(
  db: SupabaseClient,
  currentAuctionType: AuctionType,
  context: ProcurementContext,
  serperConfig: SerperSearchConfig,
  defaultSearchQuery: string,
): DynamicStructuredTool[] {
  const getHistoricalAuctionData = new DynamicStructuredTool({
    name: 'get_historical_auction_data',
    description:
      'Retrieves past closed/awarded auctions in the same category and auction type, including their final bid amounts.',
    schema: z.object({
      category: z.string().describe('The auction category to search for'),
      limit: z.number().int().min(1).max(AGENT_QUERY.MAX_LIMIT).default(AGENT_QUERY.DEFAULT_LIMIT),
    }),
    func: async ({ category, limit }) => {
      const { data } = await db
        .from('auctions')
        .select('id, title, ceiling_price, type, status, created_at')
        .eq('category', category)
        .eq('type', currentAuctionType)
        .in('status', ['CLOSED', 'AWARDED'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!data || data.length === 0) {
        return JSON.stringify({ auctions: [], message: 'No historical auctions found for this category' });
      }

      const auctionIds = data.map((a: { id: string }) => a.id);
      const { data: bids } = await db
        .from('bids')
        .select('auction_id, amount')
        .in('auction_id', auctionIds)
        .eq('status', 'ACCEPTED');

      const result = buildHistoricalAuctionResults(
        data as Array<{ id: string; title: string; ceiling_price: number; type: string }>,
        (bids ?? []) as Array<{ auction_id: string; amount: number }>,
      );

      return JSON.stringify({ auctions: result });
    },
  });

  const getCategoryRiskStats = new DynamicStructuredTool({
    name: 'get_category_risk_stats',
    description:
      'Returns delivery failure rates and quality scores for vendors in this category to inform risk threshold calculation.',
    schema: z.object({
      category: z.string().describe('The category to analyse vendor risk for'),
    }),
    func: async ({ category }) => {
      const { data } = await db
        .from('vendor_performance_scores')
        .select('delivery_success_rate, quality_score, total_contracts, defaulted_contracts')
        .eq('category', category);

      if (!data || data.length === 0) {
        return JSON.stringify({ message: 'No performance data available for this category' });
      }

      type Score = {
        delivery_success_rate: number | null;
        quality_score: number | null;
        total_contracts: number;
        defaulted_contracts: number;
      };
      const scores = data as Score[];
      const avgDelivery =
        scores.reduce((s, r) => s + (r.delivery_success_rate ?? 0), 0) / scores.length;
      const avgQuality =
        scores.reduce((s, r) => s + (r.quality_score ?? 0), 0) / scores.length;
      const totalContracts = scores.reduce((s, r) => s + r.total_contracts, 0);
      const totalDefaults = scores.reduce((s, r) => s + r.defaulted_contracts, 0);

      return JSON.stringify({
        vendor_count: scores.length,
        avg_delivery_success_rate: avgDelivery.toFixed(2),
        avg_quality_score: avgQuality.toFixed(2),
        total_contracts: totalContracts,
        total_defaults: totalDefaults,
        default_rate_pct:
          totalContracts > 0 ? ((totalDefaults / totalContracts) * 100).toFixed(2) : '0.00',
      });
    },
  });

  const calculatePriceStatistics = new DynamicStructuredTool({
    name: 'calculate_price_statistics',
    description:
      'Calculates median, standard deviation, and suggested decrement from historical bid amounts in paise.',
    schema: z.object({
      amounts: z
        .array(z.number().int())
        .describe('Array of historical final bid amounts in paise'),
    }),
    func: async ({ amounts }) => {
      if (amounts.length === 0) {
        return JSON.stringify({ error: 'No amounts provided' });
      }

      const sorted = [...amounts].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
          : sorted[mid]!;

      const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const variance =
        amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / amounts.length;
      const stdDev = Math.round(Math.sqrt(variance));

      const suggestedDecrement = Math.max(
        Math.round(stdDev * PRICE_INTELLIGENCE.DECREMENT_STDDEV_COEFFICIENT),
        PRICE_INTELLIGENCE.MIN_DECREMENT_PAISE,
      );

      return JSON.stringify({
        count: amounts.length,
        median_paise: median,
        mean_paise: Math.round(mean),
        std_dev_paise: stdDev,
        suggested_decrement_paise: suggestedDecrement,
        suggested_risk_threshold_paise: Math.round(
          median * PRICE_INTELLIGENCE.RISK_THRESHOLD_MEDIAN_COEFFICIENT,
        ),
      });
    },
  });

  const searchWebPricingEvidence = new DynamicStructuredTool({
    name: 'search_web_pricing_evidence',
    description:
      'Searches the web for current market pricing evidence. Returns scored price signals extracted from live pages. Always call this first to get web evidence before relying on historical data alone.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'Search query for current market prices. Leave empty to use the pre-built query for this item.',
        )
        .optional(),
    }),
    func: async ({ query }) => {
      const searchQuery = query?.trim() || defaultSearchQuery;
      const results = await searchSerper(searchQuery, serperConfig);

      if (results.length === 0) {
        return JSON.stringify({ signals: [], message: 'No web results found' });
      }

      const signals = await extractWebEvidenceSignals({
        context,
        results,
        timeoutMs: serperConfig.timeoutMs,
      });

      return JSON.stringify({
        signals,
        query_used: searchQuery,
        raw_results_count: results.length,
        usable_signals_count: signals.length,
      });
    },
  });

  return [
    searchWebPricingEvidence,
    getHistoricalAuctionData,
    getCategoryRiskStats,
    calculatePriceStatistics,
  ];
}
