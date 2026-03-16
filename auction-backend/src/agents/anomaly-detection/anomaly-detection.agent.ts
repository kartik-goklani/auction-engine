import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import type { AIMessage } from '@langchain/core/messages';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AI, ANOMALY } from '../../common/constants';
import { createAnomalyDetectionTools } from './anomaly-detection.tools';
import type { AnomalyFlag } from './anomaly-window.service';

// ── Agent input ───────────────────────────────────────────────────────────────

export interface AnomalyAgentInput {
  auctionId:      string;
  agentRunId:     string;
  triggeringBid:  {
    bidId:    string;
    vendorId: string;
    amount:   number;   // paise
    placedAt: string;   // ISO string
  };
  flags:          AnomalyFlag[];   // from Tier 1, always non-empty
  auctionContext: {
    type:             string;   // REVERSE | FORWARD | SEALED_BID
    currentBestPrice: number;   // paise
    vendorCount:      number;
    elapsedMinutes:   number;
  };
}

// ── Agent result ──────────────────────────────────────────────────────────────

export interface AnomalyDetectionResult {
  anomalyDetected: boolean;
  toolCalls:       Array<{ tool_name: string; input: unknown; output: unknown }>;
  tokensUsed:      number;
  error?:          string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function paise2rupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

function buildSystemPrompt(input: AnomalyAgentInput): string {
  const { auctionId, triggeringBid, flags, auctionContext } = input;

  return `You are an anomaly investigation agent for a procurement auction platform.
Tier 1 deterministic checks have already flagged the following patterns in auction ${auctionId}. Your job is to INVESTIGATE these flags using the available tools and determine whether each flag represents a genuine alert that warrants notifying the buyer.

Flags raised by Tier 1:
${JSON.stringify(flags, null, 2)}

Triggering bid (amounts in rupees):
- Vendor: ${triggeringBid.vendorId}
- Amount: ₹${paise2rupees(triggeringBid.amount)}
- Time: ${triggeringBid.placedAt}

Auction context:
- Type: ${auctionContext.type}
- Current best price: ₹${paise2rupees(auctionContext.currentBestPrice)}
- Vendors participating: ${auctionContext.vendorCount}
- Elapsed: ${auctionContext.elapsedMinutes} minutes

Investigation guidelines:
- For SCRIPTED_BIDDING or EXTREME_DROP: call get_vendor_bid_history for the flagged vendor, then check get_vendor_flag_history for prior patterns.
- For COORDINATED_TIMING: call get_vendor_pair_co_auctions for the vendor pair, then get_vendor_flag_history for each vendor individually.
- For IDENTICAL_AMOUNTS: call get_vendor_flag_history for each involved vendor.
- For BELOW_RISK_THRESHOLD: call get_vendor_bid_history to check if this vendor corrected course immediately (fat-finger) or persisted.
- Only call raise_alert when you are confident the flag is genuine. A first-time vendor with no flag history and a plausible explanation is likely a false positive.
- You may call raise_alert multiple times if multiple distinct anomaly types are confirmed.
- If you determine all flags are false positives, do not call raise_alert. The investigation is still valuable — it produced a clean result.
- When writing alert descriptions, always express monetary amounts in rupees (₹) format. Never use paise values.`;
}

// ── Graph ─────────────────────────────────────────────────────────────────────

function shouldContinue(state: typeof MessagesAnnotation.State): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  return lastMessage.tool_calls && lastMessage.tool_calls.length > 0 ? 'tools' : END;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runAnomalyDetectionAgent(
  db: SupabaseClient,
  input: AnomalyAgentInput,
): Promise<AnomalyDetectionResult> {
  const tools          = createAnomalyDetectionTools(db, input.auctionId, input.agentRunId);
  const model          = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });
  const modelWithTools = model.bindTools(tools);

  const agentNode = async (state: typeof MessagesAnnotation.State) => {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: [response] };
  };

  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent')
    .compile();

  const systemPrompt = buildSystemPrompt(input);

  try {
    const finalState = await graph.invoke(
      { messages: [{ role: 'user', content: systemPrompt }] },
      { recursionLimit: ANOMALY.MAX_ITERATIONS },
    );

    // Collect tool calls from graph messages
    const toolCalls: Array<{ tool_name: string; input: unknown; output: unknown }> = [];
    const messages = finalState.messages as AIMessage[];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const responseMsg = messages[i + 1];
          toolCalls.push({
            tool_name: tc.name,
            input:     tc.args,
            output:    responseMsg?.content ?? null,
          });
        }
      }
    }

    // Sum token usage across all AI messages
    const tokensUsed = messages.reduce((total, msg) => {
      const usage = (msg as AIMessage & { usage_metadata?: { total_tokens?: number } }).usage_metadata;
      return total + (usage?.total_tokens ?? 0);
    }, 0);

    // anomalyDetected is determined by AgentsService querying auction_alerts by
    // agentRunId after the agent completes — raise_alert tool handles the DB side-effect
    return { anomalyDetected: false, toolCalls, tokensUsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { anomalyDetected: false, toolCalls: [], tokensUsed: 0, error: message };
  }
}
