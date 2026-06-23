'use client';

import { useState } from 'react';
import type { AgentRunRow } from '@/lib/types';
import { AgentRunStatus, AgentType } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { JsonViewer } from '@/components/ui/JsonViewer';
import { ChevronDown, ChevronRight, Terminal, Clock, Coins, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCall {
  tool_name: string;
  input: unknown;
  output: unknown;
}

interface AgentTraceViewerProps {
  runs: AgentRunRow[];
  className?: string;
}

const AGENT_LABELS: Record<AgentType, string> = {
  [AgentType.PRICE_INTELLIGENCE]:    'Price Intelligence',
  [AgentType.VENDOR_SHORTLIST]:      'Vendor Shortlisting',
  [AgentType.ANOMALY_DETECTION]:     'Anomaly Detection',
  [AgentType.AWARD_RECOMMENDATION]:  'Award Recommendation',
};

function ToolCallRow({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[4px] border border-border-subtle overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-elevated transition-colors"
      >
        {open ? <ChevronDown size={12} className="text-text-muted shrink-0" /> : <ChevronRight size={12} className="text-text-muted shrink-0" />}
        <Terminal size={11} className="text-accent shrink-0" />
        <span className="font-mono text-xs font-medium text-text-primary">{call.tool_name}</span>
      </button>
      {open && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle">
          {(['input', 'output'] as const).map((key) => (
            <div key={key} className="px-3 py-2">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-text-muted">{key}</p>
              <div className="overflow-x-auto py-1">
                <JsonViewer value={call[key]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentRunAccordion({ run }: { run: AgentRunRow }) {
  const [open, setOpen] = useState(false);
  const toolCalls = (run.tool_calls ?? []) as ToolCall[];

  const isAnomalyWarning =
    run.agent_type === AgentType.ANOMALY_DETECTION &&
    (run.final_output as Record<string, unknown> | null)?.anomaly_detected === true;

  return (
    <div
      className={cn(
        'rounded-[4px] border overflow-hidden',
        isAnomalyWarning ? 'border-warning/50 bg-warning/[0.03]' : 'border-border-subtle',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left bg-bg-elevated hover:bg-bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
          {isAnomalyWarning && (
            <AlertTriangle size={13} className="text-warning shrink-0" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {AGENT_LABELS[run.agent_type] ?? run.agent_type}
          </span>
          <Badge
            variant={run.status === AgentRunStatus.SUCCESS ? 'success' : 'danger'}
            size="sm"
          >
            {run.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-text-muted">
          {run.duration_ms != null && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {(run.duration_ms / 1000).toFixed(1)}s
            </span>
          )}
          {run.tokens_used != null && (
            <span className="flex items-center gap-1">
              <Coins size={10} />
              {run.tokens_used.toLocaleString()} tokens
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 flex flex-col gap-3 border-t border-border-subtle">
          {toolCalls.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
                Tool Calls ({toolCalls.length})
              </p>
              <div className="flex flex-col gap-1">
                {toolCalls.map((call, idx) => (
                  <ToolCallRow key={idx} call={call} />
                ))}
              </div>
            </div>
          )}

          {run.final_output && (
            <div>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-text-muted">Final Output</p>
              <div className="rounded-[4px] bg-bg-input border border-border-subtle px-3 py-2.5 overflow-x-auto">
                <JsonViewer value={run.final_output} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentTraceViewer({ runs, className }: AgentTraceViewerProps) {
  if (runs.length === 0) {
    return (
      <div className={cn('py-8 text-center text-xs text-text-muted', className)}>
        No agent runs recorded for this auction.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {runs.map((run) => (
        <AgentRunAccordion key={run.id} run={run} />
      ))}
    </div>
  );
}
