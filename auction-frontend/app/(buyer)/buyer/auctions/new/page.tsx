'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auctionsApi, agentsApi } from '@/lib/api';
import type { PriceIntelligenceSuggestion } from '@/lib/types';
import { AuctionType, AuctionVisibility, ConfidenceLevel } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PriceIntelligenceCard } from '@/components/agent/PriceIntelligenceCard';
import { ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';

const CONFIDENCE_BADGE_VARIANT: Record<ConfidenceLevel, 'success' | 'warning' | 'danger'> = {
  [ConfidenceLevel.HIGH]:   'success',
  [ConfidenceLevel.MEDIUM]: 'warning',
  [ConfidenceLevel.LOW]:    'danger',
};
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

// ── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  description: string;
  /** Value from the select — one of CATEGORY_OPTIONS or '__OTHER__' */
  categoryKey: string;
  /** Free-text entered when categoryKey === '__OTHER__' */
  categoryCustom: string;
  quantity: string;
  unit: string;
  brandName: string;
  modelNumber: string;
  keySpecs: string;
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
  // Reserve price
  reservePriceEnabled: boolean;
  reservePriceRupees: string;
  // Reserve price
  reservePriceEnabled: boolean;
  reservePriceRupees:  string;
  // Traffic light
  trafficLightEnabled: boolean;
  trafficLightGreenPct: string;
  trafficLightYellowPct: string;
}

const INITIAL: FormState = {
  title: '', description: '',
  categoryKey: '', categoryCustom: '',
  quantity: '', unit: '',
  brandName: '', modelNumber: '', keySpecs: '',
  auctionType: AuctionType.REVERSE,
  visibility: AuctionVisibility.RANK,
  startTime: '', endTime: '',
  ceilingPriceRupees: '', minDecrementRupees: '', riskThresholdRupees: '',
  autoExtendTriggerMin: '5', autoExtendMin: '5',
  reservePriceEnabled: false, reservePriceRupees: '',
  trafficLightEnabled: false, trafficLightGreenPct: '5', trafficLightYellowPct: '15',
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
  const [aiSuggestion, setAiSuggestion] = useState<PriceIntelligenceSuggestion | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function triggerPriceIntelligence() {
    const title = form.title.trim();
    const category = resolveCategory(form);
    const quantity = Number(form.quantity);
    const unit = form.unit.trim();
    if (!title) {
      setError('Enter an auction title before running AI Suggest.');
      return;
    }
    if (!category) {
      setError('Select a category before running AI Suggest.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid quantity before running AI Suggest.');
      return;
    }
    if (!unit) {
      setError('Enter a unit before running AI Suggest.');
      return;
    }
    setError('');
    setAiLoading(true);
    try {
      const suggestion = await agentsApi.analyzePriceIntelligence({
        title,
        description: form.description.trim() || undefined,
        category,
        quantity,
        unit,
        brandName: form.brandName.trim() || undefined,
        modelNumber: form.modelNumber.trim() || undefined,
        keySpecs: form.keySpecs.trim() || undefined,
        type: form.auctionType,
      });
      setAiSuggestion(suggestion);
      setShowAiModal(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI analysis failed. Fill in values manually.');
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestions(data: { openingPrice: number; minDecrement: number; riskThreshold?: number | null }) {
    const nextState: Partial<FormState> = {
      ceilingPriceRupees:  (data.openingPrice / 100).toFixed(2),
      minDecrementRupees:  (data.minDecrement  / 100).toFixed(2),
      riskThresholdRupees: '',
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
    const quantity = Number(form.quantity);
    const unit = form.unit.trim();
    if (!category) {
      setError('Please select a category.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Please enter a valid quantity.');
      return;
    }
    if (!unit) {
      setError('Please enter a unit.');
      return;
    }
    if (form.reservePriceEnabled) {
      const reserveVal = parseFloat(form.reservePriceRupees);
      const ceilingVal = parseFloat(form.ceilingPriceRupees);
      if (!form.reservePriceRupees || !Number.isFinite(reserveVal) || reserveVal <= 0) {
        setError('Reserve price must be a positive number.');
        return;
      }
      if (Number.isFinite(ceilingVal)) {
        if (form.auctionType === AuctionType.FORWARD && reserveVal <= ceilingVal) {
          setError('Reserve price must be above the floor price for a forward auction.');
          return;
        }
        if (form.auctionType !== AuctionType.FORWARD && reserveVal >= ceilingVal) {
          setError('Reserve price must be below the ceiling price for a reverse auction.');
          return;
        }
      }
    }
    if (form.trafficLightEnabled) {
      const gPct = Number(form.trafficLightGreenPct);
      const yPct = Number(form.trafficLightYellowPct);
      if (!Number.isFinite(gPct) || gPct < 1 || gPct > 50) {
        setError('Green threshold must be between 1 and 50.');
        return;
      }
      if (!Number.isFinite(yPct) || yPct < 2 || yPct > 99) {
        setError('Yellow threshold must be between 2 and 99.');
        return;
      }
      if (gPct >= yPct) {
        setError('Yellow threshold must be greater than green threshold.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const auction = await auctionsApi.create({
        title:               form.title,
        description:         form.description,
        category,
        quantity,
        unit,
        brandName: form.brandName.trim() || undefined,
        modelNumber: form.modelNumber.trim() || undefined,
        keySpecs: form.keySpecs.trim() || undefined,
        type:              form.auctionType,
        visibility:          form.visibility,
        // Convert local datetime-local strings to UTC ISO strings (Bug 3 fix)
        startTime:         form.startTime ? localToIso(form.startTime) : form.startTime,
        endTime:           form.endTime   ? localToIso(form.endTime)   : form.endTime,
        ceilingPrice:         rupeesToPaise(form.ceilingPriceRupees),
        reservePrice:         form.reservePriceEnabled && form.reservePriceRupees
                                ? rupeesToPaise(form.reservePriceRupees)
                                : undefined,
        reservePriceEnabled:  form.reservePriceEnabled || undefined,
        minDecrement:         rupeesToPaise(form.minDecrementRupees),
        autoExtendTrigger: parseInt(form.autoExtendTriggerMin) || 5,
        autoExtendMinutes: parseInt(form.autoExtendMin)        || 5,
        trafficLightEnabled:   form.trafficLightEnabled || undefined,
        trafficLightGreenPct:  form.trafficLightEnabled ? Number(form.trafficLightGreenPct)  : undefined,
        trafficLightYellowPct: form.trafficLightEnabled ? Number(form.trafficLightYellowPct) : undefined,
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Brand"
                value={form.brandName}
                onChange={(e) => patch({ brandName: e.target.value })}
                placeholder="e.g. Apple"
              />
              <Input
                label="Model"
                value={form.modelNumber}
                onChange={(e) => patch({ modelNumber: e.target.value })}
                placeholder="e.g. Mac mini M4"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Key Specs
              </label>
              <textarea
                value={form.keySpecs}
                onChange={(e) => patch({ keySpecs: e.target.value })}
                placeholder="e.g. 16GB RAM, 256GB SSD"
                rows={2}
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Quantity"
                type="number"
                min={0}
                step={1}
                value={form.quantity}
                onChange={(e) => patch({ quantity: e.target.value })}
                placeholder="e.g. 50"
                required
              />
              <Input
                label="Unit"
                value={form.unit}
                onChange={(e) => patch({ unit: e.target.value })}
                placeholder="e.g. laptops, licenses, kg"
                required
              />
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
            {aiSuggestion && !aiLoading ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAiModal(true)}
                >
                  <Sparkles size={13} />
                  View AI Suggestions
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={triggerPriceIntelligence}
                >
                  Regenerate
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={aiLoading}
                onClick={triggerPriceIntelligence}
              >
                <Sparkles size={13} />
                AI Suggest
              </Button>
            )}
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

        {/* Reserve Price */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Reserve Price</h2>
              <p className="text-xs text-text-muted mt-0.5">Minimum acceptable bid. Never shown to suppliers.</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.reservePriceEnabled}
                onChange={(e) => patch({ reservePriceEnabled: e.target.checked, reservePriceRupees: '' })}
              />
              <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-accent peer-focus:ring-2 peer-focus:ring-accent/30 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          {form.reservePriceEnabled && (
            <div className="mt-4 flex flex-col gap-2">
              <Input
                label={`Reserve Price (₹)`}
                type="number"
                min={0}
                step={0.01}
                value={form.reservePriceRupees}
                onChange={(e) => patch({ reservePriceRupees: e.target.value })}
                placeholder="0.00"
                hint={
                  form.auctionType === AuctionType.FORWARD
                    ? 'Minimum price the buyer will accept — bids below this trigger reserve not met'
                    : 'Maximum price the buyer will award at — bids above this trigger reserve not met'
                }
                required
              />
              {aiSuggestion?.suggested_reserve_price != null && aiSuggestion.reserve_confidence != null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    AI suggests: {formatCurrency(aiSuggestion.suggested_reserve_price)}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-accent hover:underline"
                    onClick={() => patch({
                      reservePriceEnabled: true,
                      // Agent output is in paise; form stores rupees
                      reservePriceRupees: (aiSuggestion.suggested_reserve_price! / 100).toFixed(2),
                    })}
                  >
                    Use this
                  </button>
                </div>
              )}
              {aiSuggestion?.reserve_confidence === null &&
                aiSuggestion?.reserve_price_basis === 'insufficient_evidence' && (
                <p className="text-xs text-amber-600">
                  Insufficient data to suggest a reserve price. Set manually.
                </p>
              )}
            </div>
          )}

          {/* Show AI reserve hint when toggle is off */}
          {!form.reservePriceEnabled &&
            aiSuggestion?.suggested_reserve_price != null &&
            aiSuggestion.reserve_confidence != null && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-text-muted">
                AI suggests a reserve price of {formatCurrency(aiSuggestion.suggested_reserve_price)}
              </span>
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => patch({
                  reservePriceEnabled: true,
                  reservePriceRupees: (aiSuggestion.suggested_reserve_price! / 100).toFixed(2),
                })}
              >
                Use this
              </button>
            </div>
          )}
        </Card>

        {/* Traffic Light Config — not shown for SEALED_BID (signals are always DISABLED there) */}
        {form.auctionType !== AuctionType.SEALED_BID && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Competitiveness Signal</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Show suppliers a colour signal after each bid — without revealing the actual price
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.trafficLightEnabled}
                  onChange={(e) => patch({ trafficLightEnabled: e.target.checked })}
                />
                <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-accent peer-focus:ring-2 peer-focus:ring-accent/30 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>

            {form.trafficLightEnabled && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Green threshold (%)"
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={form.trafficLightGreenPct}
                    onChange={(e) => patch({ trafficLightGreenPct: e.target.value })}
                    hint="Vendor is within this % of best price"
                  />
                  <Input
                    label="Yellow threshold (%)"
                    type="number"
                    min={2}
                    max={99}
                    step={1}
                    value={form.trafficLightYellowPct}
                    onChange={(e) => patch({ trafficLightYellowPct: e.target.value })}
                    hint="Must be greater than green threshold"
                  />
                </div>

                {/* Live preview */}
                <div className="flex items-center gap-4 rounded-lg border border-border-default bg-bg-elevated px-4 py-2.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-700 font-medium">Competitive</span>
                    <span className="text-text-muted ml-1">within {form.trafficLightGreenPct || '?'}%</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-amber-700 font-medium">Marginal</span>
                    <span className="text-text-muted ml-1">{form.trafficLightGreenPct || '?'}–{form.trafficLightYellowPct || '?'}%</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-red-700 font-medium">Not competitive</span>
                    <span className="text-text-muted ml-1">above {form.trafficLightYellowPct || '?'}%</span>
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

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

      {/* AI suggestions modal */}
      <Modal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="AI Price Suggestions"
        size="lg"
        disableBackdropClose
      >
        {/* Compact subheader: category · confidence badge · regenerate */}
        <div className="-mt-2 mb-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">{resolveCategory(form)}</span>
          {aiSuggestion?.confidence_level && (
            <Badge variant={CONFIDENCE_BADGE_VARIANT[aiSuggestion.confidence_level]} size="sm">
              {aiSuggestion.confidence_level} Confidence
            </Badge>
          )}
          <button
            type="button"
            title="Regenerate suggestions"
            onClick={() => { setShowAiModal(false); void triggerPriceIntelligence(); }}
            className="ml-auto text-text-muted hover:text-text-secondary transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Flat card — modal is the visual container */}
        <PriceIntelligenceCard
          metadata={aiSuggestion}
          auctionType={form.auctionType}
          loading={false}
          onApply={applyAiSuggestions}
          summary={aiSuggestion?.analysis_summary ?? null}
          flat
        />

        {/* Unified footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-3">
          <Button variant="secondary" size="sm" onClick={() => setShowAiModal(false)}>
            Dismiss
          </Button>
          {aiSuggestion?.opening_price != null && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => applyAiSuggestions({
                openingPrice: aiSuggestion.opening_price ?? 0,
                minDecrement: aiSuggestion.suggested_decrement ?? 0,
                riskThreshold: aiSuggestion.risk_threshold,
              })}
            >
              Apply Suggestions
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
