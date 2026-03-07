import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { LoggerService } from '../common/logger/logger.service';
import { AgentType, AgentRunStatus } from '../common/types';
import { runPriceIntelligenceAgent } from './price-intelligence/price-intelligence.agent';
import { runVendorShortlistAgent, type VendorShortlistOutput } from './vendor-shortlist/vendor-shortlist.agent';
import { runAnomalyDetectionAgent } from './anomaly-detection/anomaly-detection.agent';
import { runAwardRecommendationAgent } from './award-recommendation/award-recommendation.agent';

@Injectable()
export class AgentsService {
  private readonly CONTEXT = 'AgentsService';

  constructor(
    private readonly db: DatabaseService,
    private readonly realtimeService: RealtimeService,
    private readonly logger: LoggerService,
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
    const startedAt = Date.now();
    let agentRunId: string | null = null;

    try {
      const { data: auction } = await this.db
        .getClient()
        .from('auctions')
        .select('category, ceiling_price')
        .eq('id', auctionId)
        .single();

      if (!auction) return;

      const runRow = await this.insertAgentRun(auctionId, AgentType.PRICE_INTELLIGENCE);
      agentRunId = runRow.id as string;

      this.logger.log(`Price Intelligence agent started auctionId=${auctionId} runId=${agentRunId}`, this.CONTEXT);

      const result = await runPriceIntelligenceAgent(
        this.db.getClient(),
        auctionId,
        auction.category as string,
        auction.ceiling_price as number,
      );

      if (result.output) {
        await this.db.getClient().from('auction_ai_metadata').insert({
          auction_id: auctionId,
          ceiling_price: result.output.ceiling_price,
          suggested_decrement: result.output.suggested_decrement,
          risk_threshold: result.output.risk_threshold,
          risk_note: result.output.risk_note,
          confidence_level: result.output.confidence_level,
          agent_run_id: agentRunId,
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

      if (status === AgentRunStatus.FAILED) {
        this.logger.warn(`Price Intelligence agent failed auctionId=${auctionId} runId=${agentRunId} error=${result.error}`, this.CONTEXT);
      } else {
        this.logger.log(`Price Intelligence agent completed auctionId=${auctionId} runId=${agentRunId} durationMs=${durationMs} tokens=${result.tokensUsed}`, this.CONTEXT);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Price Intelligence agent threw auctionId=${auctionId}`, message, this.CONTEXT);
      if (agentRunId) {
        await this.failAgentRun(agentRunId, err, Date.now() - startedAt);
      }
    }
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
   * Non-blocking — called by BidsService.acceptBid() after each accepted bid.
   * Writes alerts to auction_alerts and broadcasts to buyer room if detected.
   */
  runAnomalyDetection(auctionId: string, latestBidAmount: number): void {
    // intentional fire-and-forget: anomaly detection must not block bid confirmation
    void this.executeAnomalyDetection(auctionId, latestBidAmount).catch(() => undefined);
  }

  private async executeAnomalyDetection(auctionId: string, latestBidAmount: number): Promise<void> {
    const startedAt = Date.now();
    let agentRunId: string | null = null;

    try {
      const runRow = await this.insertAgentRun(auctionId, AgentType.ANOMALY_DETECTION);
      agentRunId = runRow.id as string;

      this.logger.log(`Anomaly Detection agent started auctionId=${auctionId} runId=${agentRunId}`, this.CONTEXT);

      const result = await runAnomalyDetectionAgent(
        this.db.getClient(),
        auctionId,
        agentRunId,
        latestBidAmount,
      );

      if (result.anomalyDetected) {
        // Broadcast alert to the buyer's monitoring room
        const { data: alerts } = await this.db
          .getClient()
          .from('auction_alerts')
          .select('alert_type, severity, description')
          .eq('auction_id', auctionId)
          .eq('agent_run_id', agentRunId);

        for (const alert of alerts ?? []) {
          const a = alert as { alert_type: string; severity: string; description: string };
          this.realtimeService.emitToAuction(auctionId, 'alert_raised', {
            alertType: a.alert_type,
            severity: a.severity,
            description: a.description,
          });
        }
      }

      const durationMs = Date.now() - startedAt;
      const status = result.error ? AgentRunStatus.FAILED : AgentRunStatus.SUCCESS;
      await this.completeAgentRun(agentRunId, {
        toolCalls: result.toolCalls,
        finalOutput: { anomaly_detected: result.anomalyDetected },
        tokensUsed: result.tokensUsed,
        durationMs,
        status,
      });

      if (status === AgentRunStatus.FAILED) {
        this.logger.warn(`Anomaly Detection agent failed auctionId=${auctionId} runId=${agentRunId} error=${result.error}`, this.CONTEXT);
      } else {
        this.logger.log(`Anomaly Detection agent completed auctionId=${auctionId} runId=${agentRunId} anomaly=${result.anomalyDetected} durationMs=${durationMs} tokens=${result.tokensUsed}`, this.CONTEXT);
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
    auctionId: string,
    agentType: AgentType,
  ): Promise<{ id: unknown }> {
    const { data, error } = await this.db
      .getClient()
      .from('agent_runs')
      .insert({
        auction_id: auctionId,
        agent_type: agentType,
        status: AgentRunStatus.RUNNING,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to insert agent_run: ${error?.message ?? 'unknown'}`);
    }
    return data as { id: unknown };
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
}
