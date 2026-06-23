'use client';

import { motion } from 'motion/react';
import type { AwardRecommendationRow, VendorRow } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceLevel } from '@/lib/types';
import { Trophy, ShieldAlert } from 'lucide-react';

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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card accentRule className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy size={13} className="text-accent shrink-0" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-primary">AI Award Recommendation</p>
          </div>
          {recommendation.confidence && (
            <Badge variant={CONFIDENCE_VARIANT[recommendation.confidence]} size="sm">
              {recommendation.confidence}
            </Badge>
          )}
        </div>

        <div className="border border-border-subtle bg-bg-elevated px-4 py-3 rounded-[4px] flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1">Recommended Winner</p>
            <p className="text-sm font-semibold text-text-primary">
              {vendor?.company_name ?? 'Unknown Vendor'}
            </p>
          </div>
          {recommendation.primary_bid_amount != null && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1">Winning Bid</p>
              <p className="font-mono text-base font-semibold text-accent">
                {formatCurrency(recommendation.primary_bid_amount)}
              </p>
            </div>
          )}
        </div>

        {recommendation.risk_summary && (
          <div className="flex items-start gap-2 border border-warning/25 bg-warning/8 px-3 py-2.5 rounded-[4px]">
            <ShieldAlert size={12} className="text-warning mt-0.5 shrink-0" />
            <p className="text-[11px] text-text-secondary leading-relaxed">{recommendation.risk_summary}</p>
          </div>
        )}

        {recommendation.primary_reason && (
          <p className="text-xs text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
            {recommendation.primary_reason}
          </p>
        )}

        {recommendation.recommended_next_step && (
          <p className="text-[10px] text-text-muted italic border-l border-border-accent pl-2">
            {recommendation.recommended_next_step}
          </p>
        )}

        {onAward && !awarded && (
          <motion.div whileTap={{ scale: 0.97 }} className="self-start">
            <Button type="button" variant="default" size="sm" onClick={onAward} loading={awardLoading}>
              Award Contract
            </Button>
          </motion.div>
        )}

        {awarded && (
          <Badge variant="success" size="sm" className="self-start">
            Contract Awarded
          </Badge>
        )}
      </Card>
    </motion.div>
  );
}
