'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface ReserveNotMetModalProps {
  open:          boolean;
  bestBid:       number;
  reservePrice:  number;
  gapAmount:     number;
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
    <Modal open={open} onClose={handleClose} title="Reserve Price Not Met" size="md">
      <div className="flex flex-col gap-4 pt-4">
        {/* Alert */}
        <div className="flex items-start gap-2.5 border border-danger/25 bg-danger/8 px-3 py-2.5 rounded-[4px]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-xs text-danger">
            The winning bid did not reach the minimum acceptable price.
          </p>
        </div>

        {/* Stat cells */}
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-border-subtle bg-bg-elevated p-3 rounded-[4px]">
            <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Best Bid</p>
            <p className="font-mono text-sm font-semibold text-text-primary">
              {bestBid > 0 ? formatCurrency(bestBid) : '—'}
            </p>
          </div>
          <div className="border border-border-subtle bg-bg-elevated p-3 rounded-[4px]">
            <p className="text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Reserve Price</p>
            <p className="font-mono text-sm font-semibold text-text-primary">
              {formatCurrency(reservePrice)}
            </p>
          </div>
        </div>

        {/* Shortfall */}
        <p className="text-[11px] font-mono text-danger">
          Shortfall: {formatCurrency(gapAmount)} ({gapPct.toFixed(1)}% below reserve)
        </p>

        {/* Confirmation */}
        {confirmingForceClose && (
          <div className="border border-danger/25 bg-danger/8 px-3 py-2.5 rounded-[4px]">
            <p className="text-xs text-danger">
              This will award below the reserve price. Click again to confirm.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="secondary" size="sm" onClick={onExtend}>
            Extend Auction
          </Button>
          <Button variant="destructive" size="sm" onClick={handleForceCloseClick}>
            {confirmingForceClose ? 'Yes, Force Close' : 'Force Close Anyway'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
