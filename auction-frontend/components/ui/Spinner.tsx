import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <div className={cn('flex items-center gap-2 text-text-muted', className)} role="status">
      <Loader2 size={size} className="animate-spin text-accent" />
      {label && <span className="text-xs font-medium tracking-wide text-text-muted">{label}</span>}
    </div>
  );
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[300px] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={18} className="animate-spin text-accent" />
        <span className="text-[11px] font-medium tracking-widest uppercase text-text-muted">{label}</span>
      </div>
    </div>
  );
}

Spinner.FullPage = FullPageSpinner;
Spinner.Skeleton = Skeleton;
