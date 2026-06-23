'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { motion, useAnimationControls, AnimatePresence } from 'motion/react';
import { formatCurrency } from '@/lib/utils';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface BidInputProps {
  currentBestAmount: number | null;
  minDecrement: number;
  direction: 'REVERSE' | 'FORWARD';
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

  const [displayValue, setDisplayValue] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error,    setError]    = useState('');

  const shakeControls = useAnimationControls();

  // Shake the input row whenever an error is set
  useEffect(() => {
    if (!error) return;
    void shakeControls.start({
      x: [0, -6, 6, -5, 5, -3, 3, 0],
      transition: { duration: 0.38, ease: 'easeInOut' },
    });
  }, [error, shakeControls]);

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
  const DirectionIcon = direction === 'FORWARD' ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence>
        {suggestedPaise != null && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center gap-1.5"
          >
            <DirectionIcon size={11} className="text-accent" />
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Suggested</span>
            <span className="font-mono text-[11px] font-semibold text-accent ml-1">
              {formatCurrency(suggestedPaise)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div animate={shakeControls} className="flex gap-2">
        <FormInput
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
          className="flex-1 font-mono"
        />
        <motion.div whileTap={{ scale: 0.95 }} className="shrink-0">
          <Button
            variant="default"
            size="md"
            loading={loading}
            disabled={isBlocked}
            onClick={handleSubmit}
            className={cn('min-w-[100px] font-mono', cooldown > 0 && 'opacity-50')}
          >
            {cooldown > 0 ? `${cooldown}s` : 'Place Bid'}
          </Button>
        </motion.div>
      </motion.div>

      {currentBestAmount != null && (
        <p className="text-[10px] text-text-muted">
          Current best:{' '}
          <span className="font-mono font-semibold text-text-secondary">{formatCurrency(currentBestAmount)}</span>
          {' · '}
          Min {direction === 'REVERSE' ? 'decrement' : 'increment'}:{' '}
          <span className="font-mono">{formatCurrency(minDecrement)}</span>
        </p>
      )}
    </div>
  );
}
