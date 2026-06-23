'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/textarea';

interface PauseAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}

export function PauseAuctionModal({ isOpen, onClose, onConfirm }: PauseAuctionModalProps) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Pause Auction"
      description="Vendors will be notified immediately and cannot place bids while the auction is paused."
      size="sm"
    >
      <div className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pause-reason" className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Reason for pausing
          </label>
          <Textarea
            id="pause-reason"
            rows={3}
            placeholder="Optional — visible in audit trail"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="rounded-[4px] border-border-default bg-bg-input text-text-primary text-sm placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            loading={loading}
            className="bg-warning hover:bg-warning/90 text-[#0A0A0A]"
          >
            Pause Auction
          </Button>
        </div>
      </div>
    </Modal>
  );
}
