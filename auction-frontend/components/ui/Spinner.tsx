import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <div className={cn('flex items-center gap-2 text-text-muted', className)} role="status">
      <Loader2 size={size} className="animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/** Full-page centered loading overlay */
export function FullPageSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[300px] w-full items-center justify-center">
      <Spinner size={20} label={label} />
    </div>
  );
}

/** Skeleton shimmer block — drop-in replacement for loading content */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-bg-elevated rounded-lg', className)} />
  );
}

// Namespace-style access: <Spinner.FullPage /> and <Spinner.Skeleton />
Spinner.FullPage  = FullPageSpinner;
Spinner.Skeleton  = Skeleton;
