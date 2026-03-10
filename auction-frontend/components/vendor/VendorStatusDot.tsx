import { InvitationStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const DOT_CONFIG: Record<InvitationStatus, { color: string; label: string }> = {
  [InvitationStatus.INVITED]:  { color: 'bg-warning',    label: 'Invited'  },
  [InvitationStatus.ACCEPTED]: { color: 'bg-success',    label: 'Accepted' },
  [InvitationStatus.DECLINED]: { color: 'bg-danger',     label: 'Declined' },
};

interface VendorStatusDotProps {
  status: InvitationStatus;
  showLabel?: boolean;
  className?: string;
}

export function VendorStatusDot({ status, showLabel = true, className }: VendorStatusDotProps) {
  const config = DOT_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.color)} />
      {showLabel && (
        <span className="text-xs text-text-secondary">{config.label}</span>
      )}
    </span>
  );
}
