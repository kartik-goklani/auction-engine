'use client';

import { cn } from '@/lib/utils';

interface JsonViewerProps {
  value: unknown;
  depth?: number;
}

export function JsonViewer({ value, depth = 0 }: JsonViewerProps) {
  const indent = depth * 12;

  if (value === null || value === undefined) {
    return <span className="italic text-text-muted text-[11px] font-mono">null</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span className={cn('text-[11px] font-mono', value ? 'text-success' : 'text-danger')}>
        {String(value)}
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-[11px] font-mono text-accent">{value}</span>;
  }

  if (typeof value === 'string') {
    // Tool outputs from LangChain are returned as strings, often containing
    // stringified JSON. Auto-parse strings that look like objects or arrays
    // so they expand into the nested viewer instead of rendering as a raw string.
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // Parse outside JSX to avoid constructing JSX inside a try/catch block.
      let parsedJson: unknown = null;
      let isValidJson = false;
      try {
        parsedJson = JSON.parse(trimmed);
        isValidJson = true;
      } catch {
        // Not valid JSON — fall through to plain string rendering
      }
      if (isValidJson) {
        return <JsonViewer value={parsedJson} depth={depth} />;
      }
    }
    return (
      <span className="text-[11px] font-mono text-text-secondary break-all">
        &quot;{value}&quot;
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[11px] text-text-muted italic font-mono">[]</span>;
    }
    return (
      <div className="flex flex-col gap-0.5" style={{ paddingLeft: indent }}>
        {value.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="text-[10px] text-text-muted shrink-0 font-mono">[{idx}]</span>
            <JsonViewer value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-[11px] text-text-muted italic font-mono">{'{}'}</span>;
    }
    return (
      <div className="flex flex-col gap-0.5" style={{ paddingLeft: indent }}>
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-2 items-start">
            <span className="text-[10px] text-text-muted shrink-0 font-semibold tracking-wide">
              {key}:
            </span>
            <JsonViewer value={val} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-[11px] font-mono text-text-secondary">{String(value)}</span>;
}
