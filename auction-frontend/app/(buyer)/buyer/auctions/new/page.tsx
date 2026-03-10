'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auctionsApi, agentsApi } from '@/lib/api';
import type { AuctionAiMetadata } from '@/lib/types';
import { AuctionType, AuctionVisibility } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PriceIntelligenceCard } from '@/components/agent/PriceIntelligenceCard';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';

// ── Category options ────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  'Office Supplies',
  'IT Hardware',
  'Software Licenses',
  'Furniture',
  'Industrial Equipment',
  'Logistics & Transport',
  'Professional Services',
  'Catering & Hospitality',
  'Raw Materials',
  'Facility Management',
] as const;

const OTHER_VALUE = '__OTHER__';
const PRICE_METADATA_POLL_MS = 1_500;
const PRICE_METADATA_MAX_ATTEMPTS = 10;

// ── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  /** Value from the select — one of CATEGORY_OPTIONS or '__OTHER__' */
  categoryKey: string;
  /** Free-text entered when categoryKey === '__OTHER__' */
  categoryCustom: string;
  auctionType: AuctionType;
  visibility: AuctionVisibility;
  startTime: string;
  endTime: string;
  // Paise values stored as rupee strings for input
  ceilingPriceRupees: string;
  minDecrementRupees: string;
  riskThresholdRupees: string;
  autoExtendTriggerMin: string;
  autoExtendMin: string;
}

const INITIAL: FormState = {
  title: '', description: '',
  categoryKey: '', categoryCustom: '',
  auctionType: AuctionType.REVERSE,
  visibility: AuctionVisibility.RANK,
  startTime: '', endTime: '',
  ceilingPriceRupees: '', minDecrementRupees: '', riskThresholdRupees: '',
  autoExtendTriggerMin: '5', autoExtendMin: '5',
};

function rupeesToPaise(rupees: string): number {
  return Math.round(parseFloat(rupees) * 100);
}

/** Resolve the final category string from form state. */
function resolveCategory(form: FormState): string {
  if (form.categoryKey === OTHER_VALUE) {
    return form.categoryCustom.trim()
      ? `Other — ${form.categoryCustom.trim()}`
      : 'Other';
  }
  return form.categoryKey;
}

/** Convert a datetime-local string (local time) to ISO UTC string. */
function localToIso(local: string): string {
  return new Date(local).toISOString();
}

export default function NewAuctionPage() {
  const router = useRouter();
  const [form,        setForm]        = useState<FormState>(INITIAL);
  const [aiMeta,      setAiMeta]      = useState<AuctionAiMetadata | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function triggerPriceIntelligence() {
    const category = resolveCategory(form);
    if (!category) { setError('Select a category first to get AI suggestions.'); return; }
    setError('');
    setAiLoading(true);
    let draftId: string | null = null;
    try {
      // Create a temporary draft to run price intelligence — deleted after use
      const draft = await auctionsApi.create({
        title:       form.title || 'Draft',
        description: form.description,
        category,
        type: form.auctionType,
        visibility:  form.visibility,
        startTime:  form.startTime ? localToIso(form.startTime) : new Date(Date.now() + 3_600_000).toISOString(),
        endTime:    form.endTime   ? localToIso(form.endTime)   : new Date(Date.now() + 7_200_000).toISOString(),
        ceilingPrice:       1_000_000,
        minDecrement:       10_000,
        reservePrice:       500_000,
        autoExtendTrigger: parseInt(form.autoExtendTriggerMin) || 5,
        autoExtendMinutes: parseInt(form.autoExtendMin)        || 5,
      });
      draftId = draft.id;
      let meta: AuctionAiMetadata | null = null;
      for (let attempt = 0; attempt < PRICE_METADATA_MAX_ATTEMPTS; attempt++) {
        meta = await agentsApi.priceMetadata(draft.id);
        if (meta) break;
        await new Promise((resolve) => setTimeout(resolve, PRICE_METADATA_POLL_MS));
      }

      if (!meta) {
        throw new Error('AI metadata was not ready in time');
      }

      setAiMeta(meta);
      setShowAiModal(true);
    } catch {
      setError('AI analysis failed. Fill in values manually.');
    } finally {
      // Always clean up the draft to prevent orphan auctions in the list
      if (draftId) {
        void auctionsApi.delete(draftId).catch(() => undefined);
      }
      setAiLoading(false);
    }
  }

  function applyAiSuggestions(data: { ceilingPrice: number; minDecrement: number; riskThreshold?: number | null }) {
    const nextState: Partial<FormState> = {
      ceilingPriceRupees:  (data.ceilingPrice  / 100).toFixed(2),
      minDecrementRupees:  (data.minDecrement  / 100).toFixed(2),
    };

    if (data.riskThreshold != null) {
      nextState.riskThresholdRupees = (data.riskThreshold / 100).toFixed(2);
    }

    patch(nextState);
    setShowAiModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.startTime && new Date(form.startTime) <= new Date()) {
      setError('Start time must be in the future.');
      return;
    }
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      setError('End time must be after start time.');
      return;
    }
    const category = resolveCategory(form);
    if (!category) {
      setError('Please select a category.');
      return;
    }
    setSubmitting(true);
    try {
      const auction = await auctionsApi.create({
        title:               form.title,
        description:         form.description,
        category,
        type:              form.auctionType,
        visibility:          form.visibility,
        // Convert local datetime-local strings to UTC ISO strings (Bug 3 fix)
        startTime:         form.startTime ? localToIso(form.startTime) : form.startTime,
        endTime:           form.endTime   ? localToIso(form.endTime)   : form.endTime,
        ceilingPrice:       rupeesToPaise(form.ceilingPriceRupees),
        minDecrement:       rupeesToPaise(form.minDecrementRupees),
        autoExtendTrigger: parseInt(form.autoExtendTriggerMin) || 5,
        autoExtendMinutes: parseInt(form.autoExtendMin)        || 5,
      });
      router.push(`/buyer/auctions/${auction.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create auction.');
    } finally {
      setSubmitting(false);
    }
  }

  const SELECT_CLS = 'w-full bg-bg-input text-text-primary text-sm px-4 py-2.5 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 transition-all duration-200';

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/buyer/auctions">
          <button type="button" className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text-primary">New Auction</h1>
          <p className="text-sm text-text-muted">Configure your procurement event</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Basic info */}
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Basic Details</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Office Supplies Q3 2026"
              required
            />
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="What are you procuring?"
                rows={3}
                className="w-full bg-bg-input text-text-primary text-sm px-4 py-2.5 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 transition-all duration-200 resize-none placeholder:text-text-muted"
              />
            </div>

            {/* Category dropdown (Bug 1) */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Category
                <span className="text-text-muted font-normal ml-1">— used by AI for price suggestions</span>
              </label>
              <select
                value={form.categoryKey}
                onChange={(e) => patch({ categoryKey: e.target.value, categoryCustom: '' })}
                className={SELECT_CLS}
                required
              >
                <option value="" disabled>Select a category…</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value={OTHER_VALUE}>Other…</option>
              </select>
              {form.categoryKey === OTHER_VALUE && (
                <input
                  type="text"
                  value={form.categoryCustom}
                  onChange={(e) => patch({ categoryCustom: e.target.value })}
                  placeholder="Enter custom category (optional)"
                  className="mt-2 w-full bg-bg-input text-text-primary text-sm px-4 py-2.5 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 transition-all duration-200 placeholder:text-text-muted"
                />
              )}
            </div>
          </div>
        </Card>

        {/* Auction configuration */}
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Auction Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Auction Type</label>
              <select
                value={form.auctionType}
                onChange={(e) => patch({
                  auctionType: e.target.value as AuctionType,
                  ...(e.target.value === AuctionType.FORWARD ? { riskThresholdRupees: '' } : {}),
                })}
                className={SELECT_CLS}
              >
                <option value={AuctionType.REVERSE}>Reverse (Price Down)</option>
                <option value={AuctionType.FORWARD}>Forward (Price Up)</option>
                <option value={AuctionType.SEALED_BID}>Sealed Bid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Visibility</label>
              <select
                value={form.visibility}
                onChange={(e) => patch({ visibility: e.target.value as AuctionVisibility })}
                className={SELECT_CLS}
              >
                <option value={AuctionVisibility.BLIND}>Blind (no info shown)</option>
                <option value={AuctionVisibility.RANK}>Rank Only</option>
                <option value={AuctionVisibility.PRICE}>Price Visible</option>
              </select>
            </div>
            <Input
              label="Start Time"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => patch({ startTime: e.target.value })}
              required
            />
            <Input
              label="End Time"
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => patch({ endTime: e.target.value })}
              required
            />
          </div>
        </Card>

        {/* AI Price Intelligence (Bug 2 — button only, suggestions shown in modal) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Pricing</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={aiLoading}
              onClick={triggerPriceIntelligence}
            >
              <Sparkles size={13} />
              {aiMeta ? 'Regenerate AI Suggestions' : 'AI Suggest'}
            </Button>
          </div>

          <Card>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={form.auctionType === AuctionType.FORWARD ? 'Floor Price (₹)' : 'Ceiling Price (₹)'}
                type="number"
                min={0}
                step={0.01}
                value={form.ceilingPriceRupees}
                onChange={(e) => patch({ ceilingPriceRupees: e.target.value })}
                placeholder="0.00"
                required
              />
              <Input
                label={form.auctionType === AuctionType.FORWARD ? 'Min Increment (₹)' : 'Min Decrement (₹)'}
                type="number"
                min={0}
                step={0.01}
                value={form.minDecrementRupees}
                onChange={(e) => patch({ minDecrementRupees: e.target.value })}
                placeholder="0.00"
                required
              />
              {form.auctionType !== AuctionType.FORWARD && (
                <Input
                  label="Risk Threshold (₹)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.riskThresholdRupees}
                  onChange={(e) => patch({ riskThresholdRupees: e.target.value })}
                  placeholder="0.00"
                  hint="Bids below this trigger anomaly detection"
                />
              )}
            </div>
          </Card>
        </div>

        {/* Auto-extension */}
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Auto-Extension</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Trigger Window (min)"
              type="number"
              min={1}
              value={form.autoExtendTriggerMin}
              onChange={(e) => patch({ autoExtendTriggerMin: e.target.value })}
              hint="Extend if bid arrives within N min of end"
            />
            <Input
              label="Extension Duration (min)"
              type="number"
              min={1}
              value={form.autoExtendMin}
              onChange={(e) => patch({ autoExtendMin: e.target.value })}
              hint="How many minutes to add"
            />
          </div>
        </Card>

        {error && (
          <p className="text-xs text-danger bg-danger/5 border border-danger/25 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 justify-end">
          <Link href="/buyer/auctions">
            <Button type="button" variant="secondary" size="md">Cancel</Button>
          </Link>
          <Button type="submit" variant="primary" size="md" loading={submitting}>
            Create Auction
          </Button>
        </div>
      </form>

      {/* AI suggestions modal (Bug 2) */}
      <Modal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="AI Price Suggestions"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">
            The Price Intelligence agent has analysed market data for <strong>{resolveCategory(form)}</strong>.
            Review the suggestions below and click Apply to populate the pricing fields.
          </p>
          <PriceIntelligenceCard
            metadata={aiMeta}
            auctionType={form.auctionType}
            loading={false}
            onApply={applyAiSuggestions}
            onRegenerate={() => { setShowAiModal(false); void triggerPriceIntelligence(); }}
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-border-subtle">
            <Button variant="secondary" size="sm" onClick={() => setShowAiModal(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
