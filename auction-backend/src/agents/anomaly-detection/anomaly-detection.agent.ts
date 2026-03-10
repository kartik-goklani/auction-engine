import { ChatOpenAI } from '@langchain/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReactLoop } from '../react-runner';
import { AI } from '../../common/constants';
import { createAnomalyDetectionTools } from './anomaly-detection.tools';
import { AuctionType } from '../../common/types';

export interface AnomalyDetectionResult {
  anomalyDetected: boolean;
  toolCalls: Array<{ tool_name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  error?: string;
}

export async function runAnomalyDetectionAgent(
  db: SupabaseClient,
  auctionId: string,
  agentRunId: string,
  latestBidAmount: number,
): Promise<AnomalyDetectionResult> {
  const tools = createAnomalyDetectionTools(db);
  const model = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });

  const bidAmountRupees = (latestBidAmount / 100).toFixed(2);
  const prompt = `You are a procurement anomaly detection agent. A new bid of ₹${bidAmountRupees} was just accepted in auction ${auctionId} (agent run: ${agentRunId}).

Use your tools to:
1. Fetch the risk threshold for this auction
2. Get the last 20 accepted bids for this auction
3. Analyse the bid timing pattern for collusion signals and below-risk bids
4. If any anomaly is detected, call create_anomaly_alert for each distinct anomaly type

Below-risk detection applies only to ${AuctionType.REVERSE} auctions.
If the fetched auction_type is not ${AuctionType.REVERSE} or the fetched risk threshold is null, skip the below-risk check and only evaluate timing-based collusion patterns.
Only create a BELOW_RISK_BID alert when the accepted bid that triggered this run is strictly lower than the fetched risk threshold.

IMPORTANT: When writing alert descriptions, always express monetary amounts in rupees (₹) format, never in paise. Divide paise values by 100 to get rupees.

If no anomaly is detected, return {"anomaly_detected": false}.
If anomaly is detected, return {"anomaly_detected": true} after creating the alert(s).

Return ONLY the JSON object, no other text.`;

  try {
    const { toolCalls, tokensUsed, finalContent } = await runReactLoop(model, tools, prompt);

    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as { anomaly_detected?: boolean }) : {};

    return { anomalyDetected: parsed.anomaly_detected ?? false, toolCalls, tokensUsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { anomalyDetected: false, toolCalls: [], tokensUsed: 0, error: message };
  }
}
