import { AuctionStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';

const STATUS_CONFIG: Record<
  AuctionStatus,
  { label: string; variant: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'elevated' }
> = {
  [AuctionStatus.DRAFT]:     { label: 'Draft',     variant: 'elevated' },
  [AuctionStatus.PUBLISHED]: { label: 'Scheduled', variant: 'info'     },
  [AuctionStatus.OPEN]:      { label: 'Live',       variant: 'success'  },
  [AuctionStatus.CLOSED]:    { label: 'Closed',     variant: 'warning'  },
  [AuctionStatus.AWARDED]:   { label: 'Awarded',    variant: 'success'  },
  [AuctionStatus.CANCELLED]: { label: 'Cancelled',  variant: 'danger'   },
};

interface AuctionStatusBadgeProps {
  status: AuctionStatus;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function AuctionStatusBadge({ status, size = 'sm', pulse }: AuctionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} size={size} pulse={pulse && status === AuctionStatus.OPEN}>
      {config.label}
    </Badge>
  );
}
