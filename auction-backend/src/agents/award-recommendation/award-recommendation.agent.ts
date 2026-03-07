import { ChatOpenAI } from '@langchain/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReactLoop } from '../react-runner';
import { AI } from '../../common/constants';
import { createAwardRecommendationTools } from './award-recommendation.tools';

export interface AwardRecommendationOutput {
  primary_vendor_id: string;
  primary_bid_amount: number;
  primary_reason: string;
  alternative_vendor_id: string | null;
  alternative_bid_amount: number | null;
  alternative_reason: string | null;
  risk_summary: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommended_next_step: string;
}

export interface AwardRecommendationResult {
  output: AwardRecommendationOutput | null;
  toolCalls: Array<{ tool_name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  error?: string;
}

export async function runAwardRecommendationAgent(
  db: SupabaseClient,
  auctionId: string,
): Promise<AwardRecommendationResult> {
  const tools = createAwardRecommendationTools(db);
  const model = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });

  const prompt = `You are a procurement award recommendation agent. Auction ${auctionId} has just closed.

Use your tools to:
1. Get the final bid leaderboard for this auction
2. Get vendor performance summaries for the top 3 bidders
3. Get any anomaly flags raised during this auction
4. Get the AI metadata (risk threshold) from the Price Intelligence agent

Then provide a JSON recommendation with:
- primary_vendor_id: UUID of the recommended winner
- primary_bid_amount: their winning bid in paise (integer)
- primary_reason: why this vendor should win (2-3 sentences)
- alternative_vendor_id: UUID of backup recommendation (null if none)
- alternative_bid_amount: their bid in paise (integer or null)
- alternative_reason: why they're a good alternative (or null)
- risk_summary: summary of key risks to consider (1-2 sentences)
- confidence: "HIGH", "MEDIUM", or "LOW"
- recommended_next_step: what the buyer should do next (1 sentence)

Return ONLY the JSON object, no other text. All amounts must be integers in paise.`;

  try {
    const { toolCalls, tokensUsed, finalContent } = await runReactLoop(model, tools, prompt);

    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { output: null, toolCalls, tokensUsed, error: 'Agent returned no JSON' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as AwardRecommendationOutput;
    return { output: parsed, toolCalls, tokensUsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { output: null, toolCalls: [], tokensUsed: 0, error: message };
  }
}
