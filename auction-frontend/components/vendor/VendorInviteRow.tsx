'use client';

import { useState } from 'react';
import type { InvitationRow, VendorRow } from '@/lib/types';
import { InvitationStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { VendorStatusDot } from './VendorStatusDot';
import { formatTimeAgo } from '@/lib/utils';
import { Building2 } from 'lucide-react';

interface VendorInviteRowProps {
  invitation: InvitationRow;
  vendor: VendorRow | undefined;
  onRevoke?: (auctionId: string, vendorId: string) => Promise<void>;
}

export function VendorInviteRow({ invitation, vendor, onRevoke }: VendorInviteRowProps) {
  const [loading, setLoading] = useState(false);

  async function handleRevoke() {
    if (!onRevoke) return;
    setLoading(true);
    try {
      await onRevoke(invitation.auction_id, invitation.vendor_id);
    } finally {
      setLoading(false);
    }
  }

  const canRevoke =
    onRevoke &&
    (invitation.status === InvitationStatus.INVITED ||
      invitation.status === InvitationStatus.ACCEPTED);

  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-[4px] bg-bg-elevated border border-border-subtle">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-bg-card border border-border-subtle">
          <Building2 size={14} className="text-text-muted" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {vendor?.company_name ?? 'Unknown Vendor'}
          </p>
          <p className="text-[10px] text-text-muted">
            Invited {formatTimeAgo(invitation.invited_at)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <VendorStatusDot status={invitation.status} />
        {canRevoke && (
          <Button variant="ghost" size="sm" loading={loading} onClick={handleRevoke}>
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}
