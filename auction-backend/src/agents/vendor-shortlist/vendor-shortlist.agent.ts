import { ChatOpenAI } from '@langchain/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReactLoop } from '../react-runner';
import { AI } from '../../common/constants';
import { createVendorShortlistTools } from './vendor-shortlist.tools';

export interface ShortlistedVendor {
  vendor_id: string;
  company_name: string;
  score: number;
  tier: 'PREFERRED' | 'STANDARD' | 'CAUTION';
  reason: string;
  caution_flags: string[];
}

export interface VendorShortlistOutput {
  shortlisted: ShortlistedVendor[];
  total_vendors_evaluated: number;
  methodology_note: string;
}

export interface VendorShortlistResult {
  output: VendorShortlistOutput | null;
  toolCalls: Array<{ tool_name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  error?: string;
}

export async function runVendorShortlistAgent(
  db: SupabaseClient,
  auctionId: string,
  categoryKeywords: string[],
): Promise<VendorShortlistResult> {
  const tools = createVendorShortlistTools(db);
  const model = new ChatOpenAI({ model: AI.MODEL, temperature: AI.TEMPERATURE });

  const prompt = `You are a procurement vendor shortlisting agent. Your job is to identify
and rank the best vendors for auction ${auctionId} in categories: ${categoryKeywords.join(', ')}.

Use your tools to:
1. Find vendors matching the category keywords
2. Check each vendor for active capacity or suspension flags
3. Retrieve their delivery and quality performance history

Then return a JSON object with these fields:
- shortlisted: array of vendors, each with:
  - vendor_id: string (UUID)
  - company_name: string
  - score: number 0-100
  - tier: "PREFERRED", "STANDARD", or "CAUTION"
  - reason: brief rationale (1-2 sentences)
  - caution_flags: array of active flag types (empty if none)
- total_vendors_evaluated: number
- methodology_note: brief description of scoring methodology

Return ONLY the JSON object, no other text.`;

  try {
    const { toolCalls, tokensUsed, finalContent } = await runReactLoop(model, tools, prompt);

    const jsonMatch = finalContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { output: null, toolCalls, tokensUsed, error: 'Agent returned no JSON' };
    }

    const parsed = JSON.parse(jsonMatch[0]) as VendorShortlistOutput;
    return { output: parsed, toolCalls, tokensUsed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { output: null, toolCalls: [], tokensUsed: 0, error: message };
  }
}
