import type { SupabaseClient } from '@supabase/supabase-js';
import { AgentRunStatus, AuctionType } from '../../common/types';

const MAX_METADATA_CANDIDATES = 10;

interface AuctionTypeRow {
  type: AuctionType;
}

interface AgentRunStatusRow {
  id: string;
  status: AgentRunStatus;
}

interface AuctionAiMetadataRow {
  risk_threshold: number | null;
  risk_note: string | null;
  confidence_level: string | null;
  agent_run_id: string | null;
  created_at: string | null;
}

export interface CanonicalRiskThresholdContext {
  auctionType: AuctionType | null;
  riskThreshold: number | null;
  riskNote: string | null;
  confidenceLevel: string | null;
  metadataAgentRunId: string | null;
  metadataCreatedAt: string | null;
  reason: string | null;
}

export function isMinorUnitAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function selectLatestSuccessfulMetadata(
  candidates: ReadonlyArray<AuctionAiMetadataRow>,
  successfulAgentRunIds: ReadonlySet<string>,
): AuctionAiMetadataRow | null {
  for (const candidate of candidates) {
    if (!candidate.agent_run_id) {
      continue;
    }

    if (successfulAgentRunIds.has(candidate.agent_run_id)) {
      return candidate;
    }
  }

  return null;
}

export function shouldRaiseBelowRiskAlert(
  auctionType: AuctionType | null,
  latestBidAmount: unknown,
  riskThreshold: unknown,
): boolean {
  if (auctionType !== AuctionType.REVERSE) {
    return false;
  }

  if (!isMinorUnitAmount(latestBidAmount) || !isMinorUnitAmount(riskThreshold)) {
    return false;
  }

  return latestBidAmount < riskThreshold;
}

export async function getCanonicalRiskThresholdContext(
  db: SupabaseClient,
  auctionId: string,
): Promise<CanonicalRiskThresholdContext> {
  const { data: auctionRow } = await db
    .from('auctions')
    .select('type')
    .eq('id', auctionId)
    .limit(1)
    .maybeSingle();

  const auctionType = (auctionRow as AuctionTypeRow | null)?.type ?? null;
  if (auctionType !== AuctionType.REVERSE) {
    return {
      auctionType,
      riskThreshold: null,
      riskNote: null,
      confidenceLevel: null,
      metadataAgentRunId: null,
      metadataCreatedAt: null,
      reason: 'Below-risk detection is only enabled for reverse auctions',
    };
  }

  const { data: metadataRows } = await db
    .from('auction_ai_metadata')
    .select('risk_threshold, risk_note, confidence_level, agent_run_id, created_at')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: false })
    .limit(MAX_METADATA_CANDIDATES);

  const candidates = (metadataRows ?? []) as AuctionAiMetadataRow[];
  if (candidates.length === 0) {
    return {
      auctionType,
      riskThreshold: null,
      riskNote: null,
      confidenceLevel: null,
      metadataAgentRunId: null,
      metadataCreatedAt: null,
      reason: 'No AI metadata found for this auction',
    };
  }

  const agentRunIds = candidates
    .map((row) => row.agent_run_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (agentRunIds.length === 0) {
    return {
      auctionType,
      riskThreshold: null,
      riskNote: null,
      confidenceLevel: null,
      metadataAgentRunId: null,
      metadataCreatedAt: null,
      reason: 'AI metadata rows do not reference successful agent runs',
    };
  }

  const { data: agentRuns } = await db
    .from('agent_runs')
    .select('id, status')
    .in('id', agentRunIds)
    .eq('status', AgentRunStatus.SUCCESS);

  const successfulAgentRunIds = new Set(
    ((agentRuns ?? []) as AgentRunStatusRow[]).map((row) => row.id),
  );
  const latestMetadata = selectLatestSuccessfulMetadata(candidates, successfulAgentRunIds);

  if (!latestMetadata) {
    return {
      auctionType,
      riskThreshold: null,
      riskNote: null,
      confidenceLevel: null,
      metadataAgentRunId: null,
      metadataCreatedAt: null,
      reason: 'No successful AI metadata row found for this auction',
    };
  }

  if (!isMinorUnitAmount(latestMetadata.risk_threshold)) {
    return {
      auctionType,
      riskThreshold: null,
      riskNote: latestMetadata.risk_note,
      confidenceLevel: latestMetadata.confidence_level,
      metadataAgentRunId: latestMetadata.agent_run_id,
      metadataCreatedAt: latestMetadata.created_at,
      reason: 'Latest AI metadata has no valid risk threshold',
    };
  }

  return {
    auctionType,
    riskThreshold: latestMetadata.risk_threshold,
    riskNote: latestMetadata.risk_note,
    confidenceLevel: latestMetadata.confidence_level,
    metadataAgentRunId: latestMetadata.agent_run_id,
    metadataCreatedAt: latestMetadata.created_at,
    reason: null,
  };
}
