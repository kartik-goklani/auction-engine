import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Exchange Input primitive ──────────────────────────────────────────────────
// Sharp corners, subtle border, amber focus ring.
// For labeled form fields, use FormInput from @/components/ui/FormInput.

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'flex h-8 w-full rounded-[4px] border border-border-default bg-bg-input',
        'px-3 py-1.5 text-sm text-text-primary',
        'placeholder:text-text-muted',
        'transition-colors duration-150 outline-none',
        'focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-border-accent',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger/30',
        className,
      )}
      {...props}
    />
  );
}
