import { ChatOpenAI } from '@langchain/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReactLoop } from '../react-runner';
import { AI } from '../../common/constants';
import { createPriceIntelligenceTools } from './price-intelligence.tools';
import { AuctionType } from '../../common/types';

export interface PriceIntelligenceOutput {
  ceiling_price: number;
  suggested_decrement: number;
  risk_threshold: number | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_note: string | null;
  analysis_summary: string;
}

export interface PriceIntelligenceResult {
  output: PriceIntelligenceOutput | null;
  toolCalls: Array<{ tool_name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  error?: string;
}

export async function runPriceIntelligenceAgent(
  db: SupabaseClient,
  auctionId: string,
  auctionTitle: string,
  category: string,
  currentCeilingPrice: number | null,
  auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID',
): Promise<PriceIntelligenceResult> {
  const tools = createPriceIntelligenceTools(db, auctionType as AuctionType);
  const model = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });
  const isForward = auctionType === 'FORWARD';
  const riskInstruction = isForward
    ? '- risk_threshold: null\n- risk_note: null\n'
    : '- risk_threshold: minimum acceptable bid before risk flags should trigger in paise (integer)\n- risk_note: 1-2 sentences explaining the risk rationale\n';

  const priceContext = currentCeilingPrice == null
    ? 'No buyer-entered ceiling or floor price was provided yet.'
    : `The buyer-entered starting price context is ${currentCeilingPrice} paise (₹${(currentCeilingPrice / 100).toFixed(2)}).`;

  const prompt = `You are a procurement price intelligence agent. Analyse historical auction data
for the auction titled "${auctionTitle}" in category "${category}".
${priceContext}

Use your tools to:
1. Fetch historical auction data for this category
2. Get vendor risk statistics for this category
3. Calculate price statistics from the historical bid amounts

Then provide a JSON recommendation with these fields:
- analysis_summary: 1-2 sentences summarising what data you analysed and the recommendation logic
- ceiling_price: recommended ceiling price in paise (integer)
- suggested_decrement: minimum bid decrement in paise (integer)
- auction_type: ${auctionType}
- For FORWARD auctions, do not calculate a risk threshold because the reverse-auction "too cheap" logic does not apply.
- For REVERSE and SEALED_BID auctions, keep the existing "too cheap" risk-threshold logic.
${riskInstruction}
- confidence_level: "HIGH", "MEDIUM", or "LOW" based on data quality

Return ONLY the JSON object, no other text. All amounts must be integers in paise.
Auction ID: ${auctionId}`;

  try {
    const { toolCalls, tokensUsed, finalContent } = await runReactLoop(model, tools, prompt);

    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { output: null, toolCalls, tokensUsed, error: 'Agent returned no JSON' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as PriceIntelligenceOutput;
    const normalized: PriceIntelligenceOutput = isForward
      ? {
          ...parsed,
          analysis_summary:
            parsed.analysis_summary ??
            'Used internal auction history and vendor-risk data to estimate pricing guidance.',
          risk_threshold: null,
          risk_note: null,
        }
      : {
          ...parsed,
          analysis_summary:
            parsed.analysis_summary ??
            'Used internal auction history and vendor-risk data to estimate pricing guidance.',
        };

    return { output: normalized, toolCalls, tokensUsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { output: null, toolCalls: [], tokensUsed: 0, error: message };
  }
}
