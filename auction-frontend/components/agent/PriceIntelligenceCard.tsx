import type {
  AuctionAiMetadata,
  PriceIntelligenceSuggestion,
} from '@/lib/types';
import { ConfidenceLevel, AuctionType } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceIntelligenceCardProps {
  metadata: AuctionAiMetadata | PriceIntelligenceSuggestion | null;
  loading?: boolean;
  auctionType?: AuctionType;
  onApply: (data: { ceilingPrice: number; minDecrement: number; riskThreshold?: number | null }) => void;
  onRegenerate?: () => void;
  summary?: string | null;
}

const CONFIDENCE_VARIANT: Record<ConfidenceLevel, 'success' | 'warning' | 'danger'> = {
  [ConfidenceLevel.HIGH]:   'success',
  [ConfidenceLevel.MEDIUM]: 'warning',
  [ConfidenceLevel.LOW]:    'danger',
};

export function PriceIntelligenceCard({
  metadata,
  loading = false,
  auctionType,
  onApply,
  onRegenerate,
  summary,
}: PriceIntelligenceCardProps) {
  const isForward = auctionType === AuctionType.FORWARD;
  if (loading) {
    return (
      <Card className="flex items-center gap-3 py-5">
        <Sparkles size={16} className="text-accent animate-pulse shrink-0" />
        <p className="text-sm text-text-secondary animate-pulse">Analysing internal pricing history…</p>
      </Card>
    );
  }

  if (!metadata) return null;

  const ceilingPrice  = metadata.ceiling_price      ?? 0;
  const minDecrement  = metadata.suggested_decrement ?? 0;
  const riskThreshold = metadata.risk_threshold      ?? 0;
  const metricCards = [
    { label: isForward ? 'Floor Price' : 'Ceiling Price', value: formatCurrency(ceilingPrice) },
    { label: isForward ? 'Min Increment' : 'Min Decrement', value: formatCurrency(minDecrement) },
  ];

  if (!isForward && metadata.risk_threshold != null) {
    metricCards.push({ label: 'Risk Threshold', value: formatCurrency(riskThreshold) });
  }

  return (
    <Card className={cn('flex flex-col gap-4 border-accent/25 bg-gradient-to-b from-accent/5 to-transparent')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent shrink-0" />
          <p className="text-sm font-semibold text-text-primary">AI Price Intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          {metadata.confidence_level && (
            <Badge variant={CONFIDENCE_VARIANT[metadata.confidence_level]} size="sm">
              {metadata.confidence_level} Confidence
            </Badge>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      <div className={cn('grid gap-3', metricCards.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {metricCards.map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-bg-elevated px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      {summary && (
        <p className="text-xs text-text-secondary leading-relaxed">
          {summary}
        </p>
      )}

      {metadata.risk_note && !isForward && (
        <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
          {metadata.risk_note}
        </p>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onApply({
          ceilingPrice,
          minDecrement,
          riskThreshold: metadata.risk_threshold,
        })}
        className="self-start"
      >
        Apply Suggestions
      </Button>
    </Card>
  );
}
