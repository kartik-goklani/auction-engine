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
  onApply: (data: { openingPrice: number; minDecrement: number; riskThreshold?: number | null }) => void;
  onRegenerate?: () => void;
  summary?: string | null;
  /** When true: renders as a flat div (no Card wrapper, no internal header, no Apply button).
   *  Use inside a Modal where the modal itself provides the visual container and action buttons. */
  flat?: boolean;
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
  flat = false,
}: PriceIntelligenceCardProps) {
  const isForward = auctionType === AuctionType.FORWARD;
  if (loading) {
    return (
      <Card className="flex items-center gap-3 py-5">
        <Sparkles size={16} className="text-accent animate-pulse shrink-0" />
        <p className="text-sm text-text-secondary animate-pulse">Analysing current web pricing evidence…</p>
      </Card>
    );
  }

  if (!metadata) return null;
  const suggestionMetadata = 'evidence_sources' in metadata ? metadata : null;
  const hasRecommendation =
    metadata.opening_price != null &&
    metadata.suggested_decrement != null &&
    (!suggestionMetadata || !suggestionMetadata.failure_reason);

  const openingPrice  = metadata.opening_price      ?? 0;
  const minDecrement  = metadata.suggested_decrement ?? 0;
  const riskThreshold = metadata.risk_threshold      ?? 0;

  // Dynamic label: FLOOR for FORWARD auctions, CEILING for REVERSE/SEALED_BID
  const openingPriceLabel =
    'opening_price_type' in metadata && metadata.opening_price_type === 'FLOOR'
      ? 'Floor Price'
      : isForward
        ? 'Floor Price'
        : 'Ceiling Price';

  const metricCards: Array<{ label: string; value: string; badge?: string; badgeVariant?: 'success' | 'warning' | 'danger' }> = hasRecommendation
    ? [
        { label: openingPriceLabel,                             value: formatCurrency(openingPrice) },
        { label: isForward ? 'Min Increment' : 'Min Decrement', value: formatCurrency(minDecrement) },
      ]
    : [];

  if (hasRecommendation && !isForward && metadata.risk_threshold != null) {
    metricCards.push({ label: 'Risk Threshold', value: formatCurrency(riskThreshold) });
  }

  // Reserve price card — always shown when there is a recommendation
  if (hasRecommendation) {
    const reservePrice = 'suggested_reserve_price' in metadata ? metadata.suggested_reserve_price : null;
    const reserveConf  = 'reserve_confidence' in metadata ? metadata.reserve_confidence : null;
    if (reservePrice != null && reserveConf != null) {
      metricCards.push({
        label:        'Suggested Reserve',
        value:        formatCurrency(reservePrice),
        badge:        reserveConf,
        badgeVariant: reserveConf === 'HIGH' ? 'success' : 'warning',
      });
    } else {
      metricCards.push({
        label:        'Suggested Reserve',
        value:        '—',
        badge:        'LOW DATA',
        badgeVariant: 'warning',
      });
    }
  }

  const content = (
    <>
      {!flat && (
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
      )}

      {metricCards.length > 0 ? (
        <div className={cn('grid gap-3 items-start', metricCards.length <= 2 ? 'grid-cols-2' : metricCards.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
          {metricCards.map(({ label, value, badge, badgeVariant }) => (
            <div key={label} className="rounded-lg bg-bg-elevated px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{value}</p>
              {badge && (
                <Badge variant={badgeVariant ?? 'warning'} size="sm" className="mt-1">
                  {badge}
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-3">
          <p className="text-xs font-medium text-text-primary">Not Enough Pricing Evidence</p>
          <p className="mt-1 text-xs text-text-secondary">
            The agent could not find enough credible current web pricing signals to auto-fill values safely.
          </p>
        </div>
      )}

      {summary && (
        <p className="text-xs text-text-secondary leading-relaxed">
          {summary}
        </p>
      )}

      {suggestionMetadata && suggestionMetadata.evidence_sources.length > 0 && (
        <div className="border-t border-border-subtle pt-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Supporting Sources • {suggestionMetadata.market_context}
          </p>
          <div className="flex flex-col gap-2">
            {suggestionMetadata.evidence_sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="font-medium text-text-primary">{source.title}</span>
                <span className="block text-text-muted mt-0.5">
                  {source.domain} • {source.source_type.replace(/_/g, ' ')}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {metadata.risk_note && !isForward && (
        <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
          {metadata.risk_note}
        </p>
      )}

      {!flat && hasRecommendation && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onApply({
            openingPrice: openingPrice,
            minDecrement,
            riskThreshold: metadata.risk_threshold,
          })}
          className="self-start"
        >
          Apply Suggestions
        </Button>
      )}
    </>
  );

  if (flat) {
    return <div className="flex flex-col gap-4">{content}</div>;
  }

  return (
    <Card className={cn('flex flex-col gap-4 border-accent/25 bg-gradient-to-b from-accent/5 to-transparent')}>
      {content}
    </Card>
  );
}
