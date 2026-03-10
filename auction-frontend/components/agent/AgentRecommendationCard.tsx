import type { AwardRecommendationRow, VendorRow } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceLevel } from '@/lib/types';
import { Trophy, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentRecommendationCardProps {
  recommendation: AwardRecommendationRow;
  vendor: VendorRow | undefined;
  awarded?: boolean;
  onAward?: () => void;
  awardLoading?: boolean;
}

const CONFIDENCE_VARIANT: Record<ConfidenceLevel, 'success' | 'warning' | 'danger'> = {
  [ConfidenceLevel.HIGH]:   'success',
  [ConfidenceLevel.MEDIUM]: 'warning',
  [ConfidenceLevel.LOW]:    'danger',
};

export function AgentRecommendationCard({
  recommendation,
  vendor,
  awarded = false,
  onAward,
  awardLoading = false,
}: AgentRecommendationCardProps) {
  return (
    <Card className="flex flex-col gap-4 border-accent/25 bg-gradient-to-b from-accent/5 to-transparent">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-accent shrink-0" />
          <p className="text-sm font-semibold text-text-primary">AI Award Recommendation</p>
        </div>
        {recommendation.confidence && (
          <Badge variant={CONFIDENCE_VARIANT[recommendation.confidence]} size="sm">
            {recommendation.confidence} Confidence
          </Badge>
        )}
      </div>

      <div className="rounded-lg bg-bg-elevated px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Recommended Winner</p>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">
            {vendor?.company_name ?? 'Unknown Vendor'}
          </p>
        </div>
        {recommendation.primary_bid_amount != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Winning Bid</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-success">
              {formatCurrency(recommendation.primary_bid_amount)}
            </p>
          </div>
        )}
      </div>

      {recommendation.risk_summary && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
          <ShieldAlert size={13} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-text-secondary">{recommendation.risk_summary}</p>
        </div>
      )}

      {recommendation.primary_reason && (
        <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
          {recommendation.primary_reason}
        </p>
      )}

      {recommendation.recommended_next_step && (
        <p className="text-[11px] text-text-muted italic">{recommendation.recommended_next_step}</p>
      )}

      {onAward && !awarded && (
        <button
          type="button"
          onClick={onAward}
          disabled={awardLoading}
          className={cn(
            'self-start inline-flex items-center gap-2 rounded-lg px-4 py-2',
            'bg-accent text-white text-sm font-semibold',
            'border border-accent/30 shadow-[0_4px_16px_rgba(124,92,252,0.35)]',
            'hover:bg-accent-hover transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {awardLoading ? 'Awarding…' : 'Award Contract'}
        </button>
      )}

      {awarded && (
        <Badge variant="success" size="sm" className="self-start">
          Contract Awarded
        </Badge>
      )}
    </Card>
  );
}
