import { AuctionType } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<AuctionType, { label: string; color: string }> = {
  [AuctionType.REVERSE]:   { label: 'Reverse',    color: 'text-accent-blue bg-accent-blue/10'  },
  [AuctionType.FORWARD]:   { label: 'Forward',    color: 'text-text-primary bg-bg-tag'         },
  [AuctionType.SEALED_BID]:{ label: 'Sealed Bid', color: 'text-text-secondary bg-bg-elevated border border-border-subtle' },
};

interface AuctionTypeTagProps {
  type: AuctionType;
  className?: string;
}

export function AuctionTypeTag({ type, className }: AuctionTypeTagProps) {
  const config = TYPE_CONFIG[type];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-widest',
        config.color,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
