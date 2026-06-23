'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { auctionsApi, bidsApi, vendorsApi, agentsApi } from '@/lib/api';
import type { AuctionRow, BidRow as BidRowData, VendorRow, AuctionAlertRow, AuctionAiMetadata } from '@/lib/types';
import { AuctionStatus, AuctionType } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { BidTrendChart } from '@/components/auction/BidTrendChart';
import { AgentRecommendationCard } from '@/components/agent/AgentRecommendationCard';
import { AgentTraceViewer } from '@/components/agent/AgentTraceViewer';
import { BidHistory } from '@/components/bid/BidHistory';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Trophy, Gavel, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AuctionResultsPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [auction,        setAuction]        = useState<AuctionRow | null>(null);
  const [bids,           setBids]           = useState<BidRowData[]>([]);
  const [vendors,        setVendors]        = useState<VendorRow[]>([]);
  const [recommendation, setRecommendation] = useState<Awaited<ReturnType<typeof agentsApi.recommendation>> | null>(null);
  const [agentRuns,      setAgentRuns]      = useState<Awaited<ReturnType<typeof agentsApi.runs>>>([]);
  const [priceMetadata,  setPriceMetadata]  = useState<AuctionAiMetadata | null>(null);
  const [anomalyAlerts,  setAnomalyAlerts]  = useState<AuctionAlertRow[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [awardLoading,      setAwardLoading]      = useState(false);
  const [awardingVendorId,  setAwardingVendorId]  = useState<string | null>(null);

  const vendorIndexMap = useRef(new Map<string, number>());

  const load = useCallback(async () => {
    const [a, b, v, runs, meta, alerts] = await Promise.all([
      auctionsApi.get(id),
      bidsApi.list(id),
      vendorsApi.list(),
      agentsApi.runs(id),
      agentsApi.priceMetadata(id).catch(() => null),
      agentsApi.alerts(id).catch(() => [] as AuctionAlertRow[]),
    ]);

    // Build stable vendor index map
    const seen = new Set<string>();
    b.forEach((bid) => {
      if (!seen.has(bid.vendor_id)) {
        vendorIndexMap.current.set(bid.vendor_id, seen.size);
        seen.add(bid.vendor_id);
      }
    });

    setAuction(a);
    setBids(b);
    setVendors(v);
    setAgentRuns(runs);
    setPriceMetadata(meta ?? null);
    setAnomalyAlerts(alerts ?? []);

    try {
      const rec = await agentsApi.recommendation(id);
      setRecommendation(rec);
    } catch { /* No recommendation yet */ }

    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleAwardVendor(vendorId: string) {
    setAwardLoading(true);
    setAwardingVendorId(vendorId);
    try {
      await auctionsApi.award(id, vendorId);
      await load();
    } finally {
      setAwardLoading(false);
      setAwardingVendorId(null);
    }
  }

  if (loading || !auction) return <FullPageSpinner />;

  const vendorMap      = new Map(vendors.map((v) => [v.id, v]));
  const winningVendor  = recommendation ? vendorMap.get(recommendation.primary_vendor_id ?? "") : undefined;
  const acceptedBids   = bids.filter((b) => b.status === 'ACCEPTED');
  const bestBid        = acceptedBids[0];
  const isForward      = auction.type === AuctionType.FORWARD;
  const isClosed       = auction.status === AuctionStatus.CLOSED;
  const isReserveNotMet = auction.status === AuctionStatus.RESERVE_NOT_MET;
  const isAwarded      = auction.status === AuctionStatus.AWARDED;
  const noBids         = acceptedBids.length === 0;

  // Best bid per vendor, sorted by best price
  const bestBidsByVendor: Array<{ vendorId: string; amount: number }> = Object.values(
    acceptedBids.reduce<Record<string, { vendorId: string; amount: number }>>((acc, bid) => {
      const existing = acc[bid.vendor_id];
      const isBetter = isForward
        ? bid.amount > (existing?.amount ?? -Infinity)
        : bid.amount < (existing?.amount ?? Infinity);
      if (!existing || isBetter) {
        acc[bid.vendor_id] = { vendorId: bid.vendor_id, amount: bid.amount };
      }
      return acc;
    }, {}),
  ).sort((a, b) => isForward ? b.amount - a.amount : a.amount - b.amount);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/buyer/auctions/${id}`} className="inline-flex items-center justify-center p-1.5 rounded-[3px] text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
          <ArrowLeft size={14} />
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold tracking-tight text-text-primary">{auction.title}</h1>
            <AuctionStatusBadge status={auction.status} />
          </div>
          <p className="mt-0.5 text-xs text-text-muted">
            Closed {auction.end_time ? formatDate(auction.end_time) : ''}
          </p>
        </div>
      </div>

      {/* Reserve not met banner */}
      {isReserveNotMet && (
        <div className="rounded-[4px] border border-danger/30 bg-danger/8 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            <p className="text-sm font-semibold text-danger">Reserve price was not met</p>
          </div>
          <p className="text-sm text-text-muted">
            The auction closed with bids below the minimum acceptable price.
            You can force close to proceed with awarding, or extend to reopen bidding.
          </p>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await auctionsApi.forceClose(id);
                await load();
              }}
            >
              Force Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await auctionsApi.extendByMinutes(id, 5);
                router.push(`/buyer/auctions/${id}/live`);
              }}
            >
              Extend Auction
            </Button>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Bids',   value: bids.length.toString()                                        },
          { label: 'Winning Bid',  value: bestBid ? formatCurrency(bestBid.amount) : '—'                },
          { label: 'Unique Vendors', value: new Set(bids.map((b) => b.vendor_id)).size.toString()       },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-[4px] bg-bg-card border border-border-subtle border-l-2 border-l-border-default p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">{label}</p>
            <p className="mt-1 font-mono text-lg font-bold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* Price Trend Chart — same chart from the live room, persisted here */}
      {bids.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-3">Price Trend</h2>
          <BidTrendChart
            bids={bids}
            auctionType={auction.type}
            ceilingPrice={auction.ceiling_price}
            isLive={false}
            marketBenchmark={
              priceMetadata?.recommended_unit_price != null && priceMetadata?.confidence_level != null
                ? {
                    recommendedUnitPrice: priceMetadata.recommended_unit_price,
                    confidenceLevel:      priceMetadata.confidence_level,
                  }
                : undefined
            }
            anomalyAlerts={anomalyAlerts}
          />
        </Card>
      )}

      {/* AI Award Recommendation */}
      {recommendation ? (
        <AgentRecommendationCard
          recommendation={recommendation}
          vendor={winningVendor}
          awarded={isAwarded}
          onAward={isClosed ? () => handleAwardVendor(recommendation.primary_vendor_id ?? '') : undefined}
          awardLoading={awardLoading && awardingVendorId === (recommendation.primary_vendor_id ?? '')}
        />
      ) : (
        <Card className="flex items-center gap-3 py-5">
          <Trophy size={16} className="text-text-muted shrink-0" />
          <p className="text-sm text-text-secondary">
            {noBids
              ? 'No bids were submitted for this auction.'
              : 'Award recommendation is being generated…'}
          </p>
        </Card>
      )}

      {/* Manual award override */}
      {isClosed && !noBids && (
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-1">Award to a Different Vendor</h2>
          <p className="text-xs text-text-muted mb-4">
            Override the AI recommendation and award the contract manually.
          </p>
          <div className="flex flex-col gap-2">
            {bestBidsByVendor.map(({ vendorId, amount }, idx) => {
              const vendor   = vendorMap.get(vendorId);
              const name     = vendor?.company_name ?? `Vendor #${(vendorIndexMap.current.get(vendorId) ?? idx) + 1}`;
              const isAiPick = recommendation?.primary_vendor_id === vendorId;
              const isLoading = awardLoading && awardingVendorId === vendorId;
              return (
                <div
                  key={vendorId}
                  className="flex items-center justify-between gap-3 rounded-[4px] border border-border-subtle bg-bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono text-text-muted w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary truncate">{name}</span>
                        {isAiPick && (
                          <span className="text-[9px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-[2px] uppercase tracking-wide border border-border-accent">
                            AI Pick
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-sm font-bold text-success">{formatCurrency(amount)}</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isLoading}
                    onClick={() => handleAwardVendor(vendorId)}
                  >
                    <Gavel size={13} />
                    Award
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Bid leaderboard */}
      <Card>
        <h2 className="text-sm font-semibold text-text-primary mb-4">Bid Leaderboard</h2>
        <BidHistory
          bids={acceptedBids}
          showVendors
          vendorIndexMap={vendorIndexMap.current}
        />
      </Card>

      {/* Agent traces */}
      <Card>
        <h2 className="text-sm font-semibold text-text-primary mb-4">Agent Trace</h2>
        <AgentTraceViewer runs={agentRuns} />
      </Card>
    </div>
  );
}
