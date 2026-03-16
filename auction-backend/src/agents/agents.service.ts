import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../common/database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LoggerService } from '../common/logger/logger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AgentType, AgentRunStatus, AuctionType, NotificationType } from '../common/types';
import {
  runPriceIntelligenceAgent,
  type PriceIntelligenceOutput,
} from './price-intelligence/price-intelligence.agent';
import { runVendorShortlistAgent, type VendorShortlistOutput } from './vendor-shortlist/vendor-shortlist.agent';
import { runAnomalyDetectionAgent, type AnomalyAgentInput } from './anomaly-detection/anomaly-detection.agent';
import { runAwardRecommendationAgent } from './award-recommendation/award-recommendation.agent';
import { type AnomalyFlag } from './anomaly-detection/anomaly-window.service';
import type { AnalyzePriceIntelligenceDto } from './dto/analyze-price-intelligence.dto';

export interface PriceIntelligenceAnalysisResponse {
  agent_run_id: string | null;
  analysis_summary: string;
  opening_price:            number | null;
  opening_price_type:       'CEILING' | 'FLOOR';
  suggested_reserve_price:  number | null;
  reserve_price_basis:      'benchmark_plus_5pct' | 'benchmark_minus_5pct' | 'insufficient_evidence';
  reserve_confidence:       'HIGH' | 'MEDIUM' | null;
  suggested_decrement: number | null;
  risk_threshold: number | null;
  risk_note: string | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence_sources: Array<{
    title: string;
    domain: string;
    url: string;
    source_type: string;
  }>;
  market_context: string;
  evidence_breakdown: {
    web_match_count: number;
    source_mix: Record<string, number>;
  };
  failure_reason?: 'INSUFFICIENT_PRICING_EVIDENCE';
}

@Injectable()
export class AgentsService {
  private readonly CONTEXT = 'AgentsService';

  constructor(
    private readonly db: DatabaseService,
    private readonly realtimeService: RealtimeService,
    private readonly logger: LoggerService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ── Agent 1: Price Intelligence ───────────────────────────────────────────

  /**
   * Non-blocking — called by AuctionsService.create() after auction is saved.
   * Writes result to auction_ai_metadata on success.
   */
  runPriceIntelligence(auctionId: string): void {
    // intentional fire-and-forget: price intelligence must not block auction creation
    void this.executePriceIntelligence(auctionId).catch(() => undefined);
  }

  private async executePriceIntelligence(auctionId: string): Promise<void> {
    try {
      const { data: auction } = await this.db
        .getClient()
        .from('auctions')
        .select('title, description, category, quantity, unit, ceiling_price, type, brand_name, model_number, key_specs')
        .eq('id', auctionId)
        .single();

      if (!auction) return;

      const result = await this.executePriceIntelligenceRun({
        auctionId,
        title: auction.title as string,
        description: (auction.description as string | null) ?? undefined,
        category: auction.category as string,
        quantity: Number(auction.quantity),
        unit: auction.unit as string,
        currentCeilingPrice: auction.ceiling_price as number,
        auctionType: auction.type as 'REVERSE' | 'FORWARD' | 'SEALED_BID',
        persistMetadata: true,
        brandName: (auction.brand_name as string | null) ?? undefined,
        modelNumber: (auction.model_number as string | null) ?? undefined,
        keySpecs: (auction.key_specs as string | null) ?? undefined,
      });

      if (result.status === AgentRunStatus.FAILED) {
        this.logger.warn(`Price Intelligence agent failed auctionId=${auctionId} runId=${result.agentRunId} error=${result.error ?? 'unknown'}`, this.CONTEXT);
      } else {
        this.logger.log(`Price Intelligence agent completed auctionId=${auctionId} runId=${result.agentRunId} durationMs=${result.durationMs} tokens=${result.tokensUsed}`, this.CONTEXT);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Price Intelligence agent threw auctionId=${auctionId}`, message, this.CONTEXT);
    }
  }

  async analyzePriceIntelligence(
    input: AnalyzePriceIntelligenceDto,
  ): Promise<PriceIntelligenceAnalysisResponse> {
    const result = await this.executePriceIntelligenceRun({
      auctionId: null,
      title: input.title,
      description: input.description,
      category: input.category,
      quantity: input.quantity,
      unit: input.unit,
      currentCeilingPrice: null,
      auctionType: input.type,
      persistMetadata: false,
      brandName: input.brandName,
      modelNumber: input.modelNumber,
      keySpecs: input.keySpecs,
    });

    if (!result.output) {
      throw new BadGatewayException(
        result.error ?? 'Price intelligence analysis returned no usable suggestion',
      );
    }

    return {
      agent_run_id:            result.agentRunId,
      analysis_summary:        result.output.analysis_summary,
      opening_price:           result.output.opening_price,
      opening_price_type:      result.output.opening_price_type,
      suggested_reserve_price: result.output.suggested_reserve_price,
      reserve_price_basis:     result.output.reserve_price_basis,
      reserve_confidence:      result.output.reserve_confidence,
      suggested_decrement:     result.output.suggested_decrement,
      risk_threshold:          result.output.risk_threshold,
      risk_note:               result.output.risk_note,
      confidence_level:        result.output.confidence_level,
      evidence_sources:        result.output.evidence_sources,
      market_context:          result.output.market_context,
      evidence_breakdown:      result.output.evidence_breakdown,
      ...(result.output.failure_reason
        ? { failure_reason: result.output.failure_reason }
        : {}),
    };
  }

  // ── Agent 2: Vendor Shortlisting ─────────────────────────────────────────

  /**
   * Awaited by VendorsService.getShortlist() — returns the ranked vendor list.
   */
  async runVendorShortlist(
    auctionId: string,
    categoryKeywords: string[],
  ): Promise<VendorShortlistOutput | null> {
    const startedAt = Date.now();
    const runRow = await this.insertAgentRun(auctionId, AgentType.VENDOR_SHORTLIST);
    const agentRunId = runRow.id as string;

    this.logger.log(`Vendor Shortlist agent started auctionId=${auctionId} runId=${agentRunId}`, this.CONTEXT);

    try {
      const result = await runVendorShortlistAgent(
        this.db.getClient(),
        auctionId,
        categoryKeywords,
      );

      const durationMs = Date.now() - startedAt;
      const status = result.error ? AgentRunStatus.FAILED : AgentRunStatus.SUCCESS;
      await this.completeAgentRun(agentRunId, {
        toolCalls: result.toolCalls,
        finalOutput: result.output,
        tokensUsed: result.tokensUsed,
        durationMs,
        status,
      });
      this.realtimeService.emitAgentRunCompleted(auctionId, AgentType.VENDOR_SHORTLIST, agentRunId);

      if (status === AgentRunStatus.FAILED) {
        this.logger.warn(`Vendor Shortlist agent failed auctionId=${auctionId} runId=${agentRunId} error=${result.error}`, this.CONTEXT);
      } else {
        this.logger.log(`Vendor Shortlist agent completed auctionId=${auctionId} runId=${agentRunId} durationMs=${durationMs} tokens=${result.tokensUsed}`, this.CONTEXT);
      }

      return result.output;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Vendor Shortlist agent threw auctionId=${auctionId}`, message, this.CONTEXT);
      await this.failAgentRun(agentRunId, err, Date.now() - startedAt);
      return null;
    }
  }

  // ── Agent 3: Anomaly Detection ────────────────────────────────────────────

  /**
   * Non-blocking — called by BidsService after Tier 1 push + gate pass.
   * Receives pre-computed flags from the caller; skips Tier 2 gate here.
   * Tier 1 (AnomalyWindowService.push) must run structurally synchronously in
   * postAcceptancePipeline before this fire-and-forget call.
   */
  runAnomalyDetection(
    auctionId: string,
    bid: { bidId: string; vendorId: string; amount: number; placedAt: Date },
    flags: AnomalyFlag[],
  ): void {
    // intentional fire-and-forget: anomaly detection must not block bid confirmation
    void this.executeAnomalyDetection(auctionId, bid, flags).catch(() => undefined);
  }

  private async executeAnomalyDetection(
    auctionId: string,
    bid: { bidId: string; vendorId: string; amount: number; placedAt: Date },
    flags: AnomalyFlag[],
  ): Promise<void> {
    const startedAt = Date.now();
    let agentRunId: string | null = null;

    try {
      this.logger.log(
        `Anomaly Detection Tier 1 flagged auctionId=${auctionId} bidId=${bid.bidId} flags=${flags.map((f) => f.type).join(',')}`,
        this.CONTEXT,
      );

      // ── Step 1: Fetch auction context for agent ───────────────────────────
      const { data: auctionRow } = await this.db
        .getClient()
        .from('auctions')
        .select('type, buyer_id, start_time')
        .eq('id', auctionId)
        .single();

      const auctionType  = (auctionRow as { type: string; buyer_id: string; start_time: string | null } | null)?.type ?? 'REVERSE';
      const buyerId      = (auctionRow as { type: string; buyer_id: string; start_time: string | null } | null)?.buyer_id ?? null;
      const startTime    = (auctionRow as { type: string; buyer_id: string; start_time: string | null } | null)?.start_time;
      const elapsedMinutes = startTime
        ? Math.floor((Date.now() - new Date(startTime).getTime()) / 60_000)
        : 0;

      const { count: vendorCount } = await this.db
        .getClient()
        .from('vendor_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('auction_id', auctionId)
        .eq('status', 'ACCEPTED');

      // Current best price: MIN for REVERSE, MAX for FORWARD/SEALED_BID
      const isReverse = auctionType === AuctionType.REVERSE;
      const { data: bestBidRow } = await this.db
        .getClient()
        .from('bids')
        .select('amount')
        .eq('auction_id', auctionId)
        .eq('status', 'ACCEPTED')
        .order('amount', { ascending: isReverse })
        .limit(1)
        .maybeSingle();

      const currentBestPrice = (bestBidRow as { amount: number } | null)?.amount ?? bid.amount;

      // ── Step 2: Create agent_runs row ─────────────────────────────────────
      const runRow = await this.insertAgentRun(auctionId, AgentType.ANOMALY_DETECTION, bid.bidId);
      agentRunId = runRow.id as string;

      this.logger.log(`Anomaly Detection agent (Tier 2) started auctionId=${auctionId} runId=${agentRunId}`, this.CONTEXT);

      // ── Step 3: Run Tier 2 agent ──────────────────────────────────────────
      const agentInput: AnomalyAgentInput = {
        auctionId,
        agentRunId,
        triggeringBid: {
          bidId:    bid.bidId,
          vendorId: bid.vendorId,
          amount:   bid.amount,
          placedAt: bid.placedAt.toISOString(),
        },
        flags,
        auctionContext: {
          type:             auctionType,
          currentBestPrice,
          vendorCount:      vendorCount ?? 0,
          elapsedMinutes,
        },
      };

      const result = await runAnomalyDetectionAgent(this.db.getClient(), agentInput);

      // ── Step 4: Fetch alerts created by raise_alert during this run ───────
      const { data: alerts } = await this.db
        .getClient()
        .from('auction_alerts')
        .select('id, alert_type, severity, description, vendor_ids_involved')
        .eq('auction_id', auctionId)
        .eq('agent_run_id', agentRunId);

      type AlertRow = {
        id: string;
        alert_type: string;
        severity: string;
        description: string;
        vendor_ids_involved: string[];
      };
      const confirmedAlerts = (alerts ?? []) as AlertRow[];

      // ── Step 5: Emit socket + create notification for each alert ──────────
      for (const alert of confirmedAlerts) {
        this.realtimeService.emitToAuction(auctionId, 'alert_raised', {
          alertId:           alert.id,
          alertType:         alert.alert_type,
          severity:          alert.severity,
          description:       alert.description,
          vendorIdsInvolved: alert.vendor_ids_involved,
          createdAt:         new Date().toISOString(),
        });

        if (buyerId) {
          this.notificationsService.send(
            buyerId,
            NotificationType.ANOMALY_ALERT,
            `Anomaly detected: ${alert.alert_type}`,
            alert.description,
            { auctionId, alertId: alert.id, agentRunId },
          );
        }
      }

      // ── Step 6: Update agent_runs to SUCCESS ──────────────────────────────
      const durationMs   = Date.now() - startedAt;
      const alertCount   = confirmedAlerts.length;
      const anomalyDetected = alertCount > 0;
      const status = result.error ? AgentRunStatus.FAILED : AgentRunStatus.SUCCESS;

      await this.completeAgentRun(agentRunId, {
        toolCalls:   result.toolCalls,
        finalOutput: { anomaly_detected: anomalyDetected, alert_count: alertCount },
        tokensUsed:  result.tokensUsed,
        durationMs,
        status,
      });

      // ── Step 7: Emit agent_run_completed ──────────────────────────────────
      this.realtimeService.emitAgentRunCompleted(auctionId, AgentType.ANOMALY_DETECTION, agentRunId);

      if (status === AgentRunStatus.FAILED) {
        this.logger.warn(`Anomaly Detection agent failed auctionId=${auctionId} runId=${agentRunId} error=${result.error ?? 'unknown'}`, this.CONTEXT);
      } else {
        this.logger.log(`Anomaly Detection agent completed auctionId=${auctionId} runId=${agentRunId} anomaly=${anomalyDetected} alerts=${alertCount} durationMs=${durationMs} tokens=${result.tokensUsed}`, this.CONTEXT);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Anomaly Detection agent threw auctionId=${auctionId}`, message, this.CONTEXT);
      if (agentRunId) {
        await this.failAgentRun(agentRunId, err, Date.now() - startedAt);
      }
    }
  }

  // ── Agent 4: Award Recommendation ────────────────────────────────────────

  /**
   * Non-blocking — called by AuctionsService.close() after auction transitions to CLOSED.
   */
  runAwardRecommendation(auctionId: string): void {
    // intentional fire-and-forget: award recommendation must not block auction close
    void this.executeAwardRecommendation(auctionId).catch(() => undefined);
  }

  private async executeAwardRecommendation(auctionId: string): Promise<void> {
    const startedAt = Date.now();
    let agentRunId: string | null = null;

    try {
      // Pre-flight: skip entirely if auction has no accepted bids
      const { count } = await this.db
        .getClient()
        .from('bids')
        .select('id', { count: 'exact', head: true })
        .eq('auction_id', auctionId)
        .eq('status', 'ACCEPTED');

      if ((count ?? 0) === 0) {
        this.logger.log(`Award Recommendation skipped — no accepted bids auctionId=${auctionId}`, this.CONTEXT);
        return;
      }

      const runRow = await this.insertAgentRun(auctionId, AgentType.AWARD_RECOMMENDATION);
      agentRunId = runRow.id as string;

      this.logger.log(`Award Recommendation agent started auctionId=${auctionId} runId=${agentRunId}`, this.CONTEXT);

      const result = await runAwardRecommendationAgent(this.db.getClient(), auctionId);

      if (result.output) {
        await this.db
          .getClient()
          .from('auction_award_recommendations')
          .insert({
            auction_id: auctionId,
            agent_run_id: agentRunId,
            primary_vendor_id: result.output.primary_vendor_id,
            primary_bid_amount: result.output.primary_bid_amount,
            primary_reason: result.output.primary_reason,
            alternative_vendor_id: result.output.alternative_vendor_id,
            alternative_bid_amount: result.output.alternative_bid_amount,
            alternative_reason: result.output.alternative_reason,
            risk_summary: result.output.risk_summary,
            confidence: result.output.confidence,
            recommended_next_step: result.output.recommended_next_step,
          });
      }

      const durationMs = Date.now() - startedAt;
      const status = result.error ? AgentRunStatus.FAILED : AgentRunStatus.SUCCESS;
      await this.completeAgentRun(agentRunId, {
        toolCalls: result.toolCalls,
        finalOutput: result.output,
        tokensUsed: result.tokensUsed,
        durationMs,
        status,
      });
      this.realtimeService.emitAgentRunCompleted(auctionId, AgentType.AWARD_RECOMMENDATION, agentRunId);

      // Notify the buyer that their award recommendation is ready
      const { data: auctionRow } = await this.db
        .getClient()
        .from('auctions')
        .select('buyer_id, title')
        .eq('id', auctionId)
        .single();
      const buyerId = (auctionRow as { buyer_id: string; title: string } | null)?.buyer_id ?? null;
      const auctionTitle = (auctionRow as { buyer_id: string; title: string } | null)?.title ?? 'Auction';
      if (buyerId) {
        // intentional fire-and-forget: notification must not block agent run completion
        void this.notificationsService.send(
          buyerId,
          NotificationType.AWARD_ISSUED,
          `Award recommendation ready — ${auctionTitle}`,
          'The AI agent has analysed all bids and vendors. Your recommendation is ready to review.',
          { auctionId, agentRunId },
        );
      }

      if (status === AgentRunStatus.FAILED) {
        this.logger.warn(`Award Recommendation agent failed auctionId=${auctionId} runId=${agentRunId} error=${result.error}`, this.CONTEXT);
      } else {
        this.logger.log(`Award Recommendation agent completed auctionId=${auctionId} runId=${agentRunId} durationMs=${durationMs} tokens=${result.tokensUsed}`, this.CONTEXT);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Award Recommendation agent threw auctionId=${auctionId}`, message, this.CONTEXT);
      if (agentRunId) {
        await this.failAgentRun(agentRunId, err, Date.now() - startedAt);
      }
    }
  }

  // ── Agent run helpers ─────────────────────────────────────────────────────

  private async insertAgentRun(
    auctionId: string | null,
    agentType: AgentType,
    triggeringBidId?: string,
  ): Promise<{ id: unknown }> {
    const { data, error } = await this.db
      .getClient()
      .from('agent_runs')
      .insert({
        auction_id:         auctionId,
        agent_type:         agentType,
        status:             AgentRunStatus.RUNNING,
        ...(triggeringBidId ? { triggering_bid_id: triggeringBidId } : {}),
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to insert agent_run: ${error?.message ?? 'unknown'}`);
    }
    return data as { id: unknown };
  }

  private async executePriceIntelligenceRun(input: {
    auctionId: string | null;
    title: string;
    description?: string;
    category: string;
    quantity: number;
    unit: string;
    currentCeilingPrice: number | null;
    auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID';
    persistMetadata: boolean;
    brandName?: string;
    modelNumber?: string;
    keySpecs?: string;
  }): Promise<{
    agentRunId: string | null;
    output: PriceIntelligenceOutput | null;
    error?: string;
    tokensUsed: number;
    durationMs: number;
    status: AgentRunStatus;
  }> {
    const startedAt = Date.now();
    let agentRunId: string | null = null;

    try {
      const runTarget = input.auctionId ?? 'draftless-analysis';
      if (input.auctionId) {
        const runRow = await this.insertAgentRun(input.auctionId, AgentType.PRICE_INTELLIGENCE);
        agentRunId = runRow.id as string;
      }

      this.logger.log(
        `Price Intelligence agent started target=${runTarget} runId=${agentRunId}`,
        this.CONTEXT,
      );
      const traceContextId = input.auctionId ?? agentRunId ?? runTarget;

      const result = await runPriceIntelligenceAgent(
        this.db.getClient(),
        traceContextId,
        input.title,
        input.category,
        input.quantity,
        input.unit,
        input.currentCeilingPrice,
        input.auctionType,
        {
          apiKey: this.config.getOrThrow<string>('SERPER_API_KEY'),
          defaultMarket: this.config.get<string>('DEFAULT_MARKET') ?? 'India',
          timeoutMs: this.config.get<number>('SERPER_TIMEOUT_MS') ?? 5_000,
          maxResults: this.config.get<number>('SERPER_MAX_RESULTS') ?? 5,
        },
        input.description,
        input.brandName,
        input.modelNumber,
        input.keySpecs,
      );

      const durationMs = Date.now() - startedAt;
      const status = result.error ? AgentRunStatus.FAILED : AgentRunStatus.SUCCESS;
      const finalOutput = result.output == null
        ? { error: result.error ?? 'Price intelligence produced no output' }
        : result.output;

      if (agentRunId) {
        await this.completeAgentRun(agentRunId, {
          toolCalls: result.toolCalls,
          finalOutput,
          tokensUsed: result.tokensUsed,
          durationMs,
          status,
        });
        if (input.auctionId) {
          this.realtimeService.emitAgentRunCompleted(input.auctionId, AgentType.PRICE_INTELLIGENCE, agentRunId);
        }
      }

      if (input.persistMetadata && input.auctionId && agentRunId && result.output) {
        await this.persistPriceMetadata(input.auctionId, agentRunId, result.output);
      }

      return {
        agentRunId,
        output: result.output,
        error: result.error,
        tokensUsed: result.tokensUsed,
        durationMs,
        status,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startedAt;

      if (agentRunId) {
        await this.failAgentRun(agentRunId, err, durationMs);
      }

      if (err instanceof HttpException) {
        throw err;
      }

      throw err instanceof Error
        ? new BadGatewayException(err.message)
        : new BadGatewayException('Price intelligence analysis failed');
    }
  }

  private async persistPriceMetadata(
    auctionId: string,
    agentRunId: string,
    output: PriceIntelligenceOutput,
  ): Promise<void> {
    const { error } = await this.db.getClient().from('auction_ai_metadata').insert({
      auction_id:              auctionId,
      opening_price:           output.opening_price,
      opening_price_type:      output.opening_price_type,
      suggested_reserve_price: output.suggested_reserve_price,
      reserve_price_basis:     output.reserve_price_basis,
      reserve_confidence:      output.reserve_confidence,
      suggested_decrement:     output.suggested_decrement,
      risk_threshold:          output.risk_threshold,
      risk_note:               output.risk_note,
      confidence_level:        output.confidence_level,
      agent_run_id:            agentRunId,
    });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to persist price intelligence metadata: ${error.message}`,
      );
    }
  }

  private async completeAgentRun(
    agentRunId: string,
    details: {
      toolCalls: unknown;
      finalOutput: unknown;
      tokensUsed: number;
      durationMs: number;
      status: AgentRunStatus;
    },
  ): Promise<void> {
    await this.db
      .getClient()
      .from('agent_runs')
      .update({
        completed_at: new Date().toISOString(),
        tool_calls: details.toolCalls,
        final_output: details.finalOutput,
        tokens_used: details.tokensUsed,
        duration_ms: details.durationMs,
        status: details.status,
      })
      .eq('id', agentRunId);
  }

  private async failAgentRun(
    agentRunId: string,
    err: unknown,
    durationMs: number,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await this.db
      .getClient()
      .from('agent_runs')
      .update({
        completed_at: new Date().toISOString(),
        final_output: { error: message },
        duration_ms: durationMs,
        status: AgentRunStatus.FAILED,
      })
      .eq('id', agentRunId);
  }

  // ── Query methods (for controller) ───────────────────────────────────────

  async findRunsByAuction(auctionId: string): Promise<unknown[]> {
    const { data } = await this.db
      .getClient()
      .from('agent_runs')
      .select('*')
      .eq('auction_id', auctionId)
      .order('triggered_at', { ascending: false });
    return data ?? [];
  }

  async findPriceMetadataByAuction(auctionId: string): Promise<unknown> {
    const { data } = await this.db
      .getClient()
      .from('auction_ai_metadata')
      .select('*')
      .eq('auction_id', auctionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data ?? null;
  }

  async findAlertsByAuction(auctionId: string): Promise<unknown[]> {
    const { data } = await this.db
      .getClient()
      .from('auction_alerts')
      .select('*')
      .eq('auction_id', auctionId)
      .order('created_at');
    return data ?? [];
  }

  async findRecommendationByAuction(auctionId: string): Promise<unknown> {
    const { data } = await this.db
      .getClient()
      .from('auction_award_recommendations')
      .select('*')
      .eq('auction_id', auctionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data ?? null;
  }

  async getShortlistResult(auctionId: string): Promise<VendorShortlistOutput | null> {
    const { data } = await this.db
      .getClient()
      .from('agent_runs')
      .select('final_output')
      .eq('auction_id', auctionId)
      .eq('agent_type', AgentType.VENDOR_SHORTLIST)
      .eq('status', AgentRunStatus.SUCCESS)
      .order('triggered_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;
    const row = data as { final_output: unknown };
    return (row.final_output as VendorShortlistOutput) ?? null;
  }
}
