import { ChatOpenAI } from '@langchain/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReactLoop } from '../react-runner';
import { AI } from '../../common/constants';
import { createPriceIntelligenceTools } from './price-intelligence.tools';
import { AuctionType } from '../../common/types';
import { classifyItem } from './price-intelligence.classifier';
import { buildProcurementContext, buildSearchQuery } from './price-intelligence.context';
import { buildPriceRecommendation, type WebEvidenceSignal } from './price-intelligence.recommendation';
import type { SerperSearchConfig } from '../../common/lib/serper.client';

export interface PriceIntelligenceOutput {
  opening_price:            number;
  opening_price_type:       'CEILING' | 'FLOOR';
  suggested_reserve_price:  number | null;
  reserve_price_basis:      'benchmark_plus_5pct' | 'benchmark_minus_5pct' | 'insufficient_evidence';
  reserve_confidence:       'HIGH' | 'MEDIUM' | null;
  suggested_decrement: number;
  risk_threshold: number | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_note: string | null;
  analysis_summary: string;
  evidence_sources: Array<{ title: string; domain: string; url: string; source_type: string }>;
  market_context: string;
  evidence_breakdown: { web_match_count: number; source_mix: Record<string, number> };
  failure_reason?: 'INSUFFICIENT_PRICING_EVIDENCE';
}

export interface PriceIntelligenceResult {
  output: PriceIntelligenceOutput | null;
  toolCalls: Array<{ tool_name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  error?: string;
}

export async function runPriceIntelligenceAgent(
  db: SupabaseClient,
  traceContextId: string,
  title: string,
  category: string,
  quantity: number,
  unit: string,
  currentCeilingPrice: number | null,
  auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID',
  serperConfig: SerperSearchConfig,
  description?: string,
  brandName?: string,
  modelNumber?: string,
  keySpecs?: string,
): Promise<PriceIntelligenceResult> {
  const itemClass = classifyItem({ brandName, modelNumber, keySpecs, title, category, unit });
  const context = buildProcurementContext({
    title,
    category,
    description,
    brandName,
    modelNumber,
    keySpecs,
    quantity,
    unit,
    itemClass,
    market: serperConfig.defaultMarket,
  });

  const searchQuery = buildSearchQuery(context);
  const tools = createPriceIntelligenceTools(
    db,
    auctionType as AuctionType,
    context,
    serperConfig,
    searchQuery,
  );
  const model = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });

  const priceContext =
    currentCeilingPrice == null
      ? 'No buyer-entered price has been provided yet.'
      : `Buyer-entered price context: ${currentCeilingPrice} paise (₹${(currentCeilingPrice / 100).toFixed(2)}).`;

  // Phase 1 prompt: tool-gathering only. Summary is generated in Phase 2 after
  // buildPriceRecommendation runs, so the LLM receives the computed reserve price
  // value and cannot invent its own numbers.
  const toolGatherPrompt = `You are a procurement price intelligence agent analysing an item for a ${auctionType} auction.

Item: "${title}"
Category: "${category}"
${description ? `Description: "${description}"\n` : ''}\
${brandName ? `Brand: "${brandName}"\n` : ''}\
${modelNumber ? `Model: "${modelNumber}"\n` : ''}\
${keySpecs ? `Key Specs: "${keySpecs}"\n` : ''}\
Quantity: ${quantity} ${unit}
${priceContext}

Steps:
1. Call search_web_pricing_evidence to find current market prices.
2. Call get_historical_auction_data to find past auctions in this category.
3. Call get_category_risk_stats to understand vendor risk.
4. If you obtained historical bid amounts, call calculate_price_statistics.

Return only: {}
Trace context: ${traceContextId}`;

  try {
    const { toolCalls, tokensUsed: toolTokens } = await runReactLoop(model, tools, toolGatherPrompt);

    // Extract web signals from the search_web_pricing_evidence tool call
    const webToolCall = toolCalls.find((tc) => tc.tool_name === 'search_web_pricing_evidence');
    let webSignals: WebEvidenceSignal[] = [];
    if (webToolCall?.output) {
      try {
        const parsed = JSON.parse(webToolCall.output as string) as { signals?: WebEvidenceSignal[] };
        webSignals = parsed.signals ?? [];
      } catch {
        // ignore parse errors — signals stay empty
      }
    }

    // Extract historical statistics from the calculate_price_statistics tool call
    const statsToolCall = toolCalls.find((tc) => tc.tool_name === 'calculate_price_statistics');
    let historicalMedian: number | null = null;
    let historicalStdDev: number | null = null;
    if (statsToolCall?.output) {
      try {
        const parsed = JSON.parse(statsToolCall.output as string) as {
          median_paise?: number;
          std_dev_paise?: number;
        };
        historicalMedian = parsed.median_paise ?? null;
        historicalStdDev = parsed.std_dev_paise ?? null;
      } catch {
        // ignore
      }
    }

    // Build recommendation deterministically
    const recommendation = buildPriceRecommendation({
      signals: webSignals,
      historicalMedian,
      historicalStdDev,
      context,
      auctionType,
    });

    // Phase 2: generate analysis_summary in a separate single LLM call now that
    // we have the computed recommendation (including reserve price). This guarantees
    // the LLM can only reference values we explicitly provide — no invented numbers.
    const openingLabel = recommendation.opening_price_type === 'FLOOR' ? 'Floor' : 'Ceiling';
    const reserveLine =
      recommendation.suggested_reserve_price != null
        ? `Suggested reserve price: ₹${(recommendation.suggested_reserve_price / 100).toLocaleString('en-IN')} (${recommendation.reserve_confidence} confidence).`
        : `Suggested reserve price: not available — insufficient market evidence.`;
    const reserveInstruction =
      recommendation.suggested_reserve_price != null
        ? `Include ONE sentence explaining the reserve price (₹${(recommendation.suggested_reserve_price / 100).toLocaleString('en-IN')}) represents the recommended ${recommendation.opening_price_type === 'FLOOR' ? 'minimum' : 'maximum'} award price and represents fair market value for this procurement.`
        : `Include ONE sentence stating that a reserve price could not be reliably estimated due to insufficient market data, and the buyer should set it manually.`;

    const summaryPrompt = `Write a 2-sentence analysis_summary for a ${auctionType} auction procurement of "${title}" (${category}).

Evidence: ${recommendation.market_context}
Confidence: ${recommendation.confidence_level}
${openingLabel} price: ₹${(recommendation.opening_price / 100).toLocaleString('en-IN')}
${reserveLine}

${reserveInstruction}
Do NOT invent any numbers. Only reference values stated above.
Return only JSON: { "analysis_summary": "..." }`;

    const summaryResult = await model.invoke(summaryPrompt);
    const summaryRaw = typeof summaryResult.content === 'string' ? summaryResult.content : '';
    const summaryTokens =
      summaryResult.usage_metadata?.total_tokens ?? 0;

    let analysisSummary = 'Price intelligence analysis completed using available market data.';
    const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { analysis_summary?: string };
        if (parsed.analysis_summary) analysisSummary = parsed.analysis_summary;
      } catch {
        // ignore — use fallback summary
      }
    }

    const output: PriceIntelligenceOutput = {
      ...recommendation,
      risk_note:
        recommendation.risk_threshold != null
          ? `Bids below ₹${(recommendation.risk_threshold / 100).toLocaleString('en-IN')} for ${quantity} ${unit} will trigger a risk alert.`
          : null,
      analysis_summary: analysisSummary,
    };

    return { output, toolCalls, tokensUsed: toolTokens + summaryTokens };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { output: null, toolCalls: [], tokensUsed: 0, error: message };
  }
}
