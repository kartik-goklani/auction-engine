'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface BidInputProps {
  /** Best current bid in paise (used to suggest next amount) */
  currentBestAmount: number | null;
  /** Minimum decrement/increment in paise */
  minDecrement: number;
  /** REVERSE = lower is better; FORWARD = higher is better */
  direction: 'REVERSE' | 'FORWARD';
  /** Called with the paise integer the user wants to submit */
  onSubmit: (amountPaise: number) => Promise<void>;
  disabled?: boolean;
}

const COOLDOWN_SECONDS = 3;

export function BidInput({
  currentBestAmount,
  minDecrement,
  direction,
  onSubmit,
  disabled = false,
}: BidInputProps) {
  const suggestedPaise =
    currentBestAmount != null
      ? direction === 'REVERSE'
        ? currentBestAmount - minDecrement
        : currentBestAmount + minDecrement
      : null;

  // Display value in rupees (decimal string)
  const [displayValue, setDisplayValue] = useState(
    suggestedPaise != null ? (suggestedPaise / 100).toFixed(2) : '',
  );
  const [loading, setLoading]     = useState(false);
  const [cooldown, setCooldown]   = useState(0);
  const [error, setError]         = useState('');

  // Sync suggestion when best bid changes
  useEffect(() => {
    if (suggestedPaise != null) {
      setDisplayValue((suggestedPaise / 100).toFixed(2));
    }
  }, [suggestedPaise]);

  // Tick cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = useCallback(async () => {
    setError('');
    const rupees = parseFloat(displayValue);
    if (isNaN(rupees) || rupees <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    const paise = Math.round(rupees * 100);

    setLoading(true);
    try {
      await onSubmit(paise);
      setCooldown(COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bid rejected. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [displayValue, onSubmit]);

  const isBlocked = disabled || loading || cooldown > 0;

  return (
    <div className="flex flex-col gap-3">
      {suggestedPaise != null && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <ArrowDown size={12} className={direction === 'FORWARD' ? 'rotate-180' : ''} />
          Suggested: {formatCurrency(suggestedPaise)}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={displayValue}
          onChange={(e) => {
            setDisplayValue(e.target.value);
            setError('');
          }}
          inputPrefix="₹"
          placeholder="0.00"
          error={error}
          disabled={isBlocked}
          className="flex-1"
        />
        <Button
          variant="primary"
          size="md"
          loading={loading}
          disabled={isBlocked}
          onClick={handleSubmit}
          className={cn('shrink-0 min-w-[100px]', cooldown > 0 && 'opacity-60')}
        >
          {cooldown > 0 ? `Wait ${cooldown}s` : 'Place Bid'}
        </Button>
      </div>

      {currentBestAmount != null && (
        <p className="text-[10px] text-text-muted">
          Current best: <span className="font-mono font-semibold text-text-secondary">{formatCurrency(currentBestAmount)}</span>
          {' · '}Min {direction === 'REVERSE' ? 'decrement' : 'increment'}: <span className="font-mono">{formatCurrency(minDecrement)}</span>
        </p>
      )}
    </div>
  );
}
