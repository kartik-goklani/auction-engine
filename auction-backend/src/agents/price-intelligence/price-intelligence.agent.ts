import { ChatOpenAI } from '@langchain/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReactLoop } from '../react-runner';
import { AI } from '../../common/constants';
import { createPriceIntelligenceTools } from './price-intelligence.tools';

export interface PriceIntelligenceOutput {
  ceiling_price: number;
  suggested_decrement: number;
  risk_threshold: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_note: string;
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
  category: string,
  currentCeilingPrice: number,
): Promise<PriceIntelligenceResult> {
  const tools = createPriceIntelligenceTools(db);
  const model = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });

  const prompt = `You are a procurement price intelligence agent. Analyse historical auction data
for the category "${category}" and the current ceiling price of ${currentCeilingPrice} paise
(₹${(currentCeilingPrice / 100).toFixed(2)}).

Use your tools to:
1. Fetch historical auction data for this category
2. Get vendor risk statistics for this category
3. Calculate price statistics from the historical bid amounts

Then provide a JSON recommendation with these fields:
- ceiling_price: recommended ceiling price in paise (integer)
- suggested_decrement: minimum bid decrement in paise (integer)
- risk_threshold: minimum acceptable bid before risk flags should trigger in paise (integer)
- confidence_level: "HIGH", "MEDIUM", or "LOW" based on data quality
- risk_note: 1-2 sentences explaining the risk rationale

Return ONLY the JSON object, no other text. All amounts must be integers in paise.
Auction ID: ${auctionId}`;

  try {
    const { toolCalls, tokensUsed, finalContent } = await runReactLoop(model, tools, prompt);

    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { output: null, toolCalls, tokensUsed, error: 'Agent returned no JSON' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as PriceIntelligenceOutput;
    return { output: parsed, toolCalls, tokensUsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { output: null, toolCalls: [], tokensUsed: 0, error: message };
  }
}
