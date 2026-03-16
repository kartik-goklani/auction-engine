'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface ReserveNotMetModalProps {
  open:          boolean;
  bestBid:       number;  // paise
  reservePrice:  number;  // paise
  gapAmount:     number;  // paise
  gapPct:        number;
  onForceClose:  () => void;
  onExtend:      () => void;
  onOpenChange:  (open: boolean) => void;
}

export function ReserveNotMetModal({
  open,
  bestBid,
  reservePrice,
  gapAmount,
  gapPct,
  onForceClose,
  onExtend,
  onOpenChange,
}: ReserveNotMetModalProps) {
  const [confirmingForceClose, setConfirmingForceClose] = useState(false);

  function handleClose() {
    setConfirmingForceClose(false);
    onOpenChange(false);
  }

  function handleForceCloseClick() {
    if (!confirmingForceClose) {
      setConfirmingForceClose(true);
      return;
    }
    setConfirmingForceClose(false);
    onForceClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reserve Price Not Met"
      size="md"
    >
      {/* Alert */}
      <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <p className="text-sm text-red-400">
          The winning bid did not reach the minimum acceptable price.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-bg-elevated border border-border-subtle p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Best Bid</p>
          <p className="font-mono text-base font-semibold text-text-primary">
            {bestBid > 0 ? formatCurrency(bestBid) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-bg-elevated border border-border-subtle p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Reserve Price</p>
          <p className="font-mono text-base font-semibold text-text-primary">
            {formatCurrency(reservePrice)}
          </p>
        </div>
      </div>

      {/* Shortfall line */}
      <p className="text-sm text-red-400">
        Shortfall: {formatCurrency(gapAmount)} ({gapPct.toFixed(1)}% below reserve)
      </p>

      {/* Confirmation message */}
      {confirmingForceClose && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">
            This will award below the reserve price. Click again to confirm.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="secondary" size="sm" onClick={onExtend}>
          Extend Auction
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleForceCloseClick}
        >
          {confirmingForceClose ? 'Yes, Force Close' : 'Force Close Anyway'}
        </Button>
      </div>
    </Modal>
  );
}
