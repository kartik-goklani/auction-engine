/**
 * Stateless ReAct loop — replaces the deprecated createReactAgent.
 *
 * Runs a tool-calling LLM loop until the model produces a response with
 * no further tool calls, then returns the full message history, a typed
 * tool-call trace, and the total token count.
 *
 * This is intentionally stateless (no checkpointer / entrypoint) because
 * all four agents are single-shot: triggered once, run to completion, and
 * their outputs are written to the database.
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { AI } from '../common/constants';

export interface ToolCallTrace {
  tool_name: string;
  input: unknown;
  output: unknown;
}

export interface ReactRunnerResult {
  /** Full message history for debugging / LangSmith tracing */
  messages: BaseMessage[];
  /** Structured trace of every tool call made */
  toolCalls: ToolCallTrace[];
  /** Total tokens used across all LLM calls in the loop */
  tokensUsed: number;
  /** Last AI message content as a string */
  finalContent: string;
}

export async function runReactLoop(
  model: ChatOpenAI,
  tools: DynamicStructuredTool[],
  systemPrompt: string,
): Promise<ReactRunnerResult> {
  const modelWithTools = model.bindTools(tools);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const messages: BaseMessage[] = [new HumanMessage(systemPrompt)];
  const toolCalls: ToolCallTrace[] = [];
  let tokensUsed = 0;

  for (let iteration = 0; iteration < AI.MAX_ITERATIONS; iteration++) {
    const response = await modelWithTools.invoke(messages) as AIMessage;
    messages.push(response);

    // Accumulate token usage
    const usage = (response as unknown as { usage_metadata?: { total_tokens?: number } })
      .usage_metadata;
    tokensUsed += usage?.total_tokens ?? 0;

    // No tool calls — model is done
    if (!response.tool_calls || response.tool_calls.length === 0) break;

    // Execute each tool call and record the trace
    for (const toolCall of response.tool_calls) {
      const tool = toolMap.get(toolCall.name);

      let output: unknown;
      try {
        output = tool ? await tool.invoke(toolCall.args as Record<string, unknown>) : `Unknown tool: ${toolCall.name}`;
      } catch (err: unknown) {
        output = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
      }

      toolCalls.push({
        tool_name: toolCall.name,
        input: toolCall.args,
        output,
      });

      messages.push(
        new ToolMessage({
          content: typeof output === 'string' ? output : JSON.stringify(output),
          tool_call_id: toolCall.id ?? '',
        }),
      );
    }
  }

  const lastAiMessage = [...messages]
    .reverse()
    .find((m): m is AIMessage => m._getType() === 'ai');

  const finalContent =
    typeof lastAiMessage?.content === 'string'
      ? lastAiMessage.content
      : JSON.stringify(lastAiMessage?.content ?? '');

  return { messages, toolCalls, tokensUsed, finalContent };
}
