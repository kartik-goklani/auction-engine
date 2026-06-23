import * as React from 'react';
import { cn } from '@/lib/utils';

// ── Exchange Card primitive ────────────────────────────────────────────────────
// Signature: tight 4px radius, near-invisible border, no shadow by default.
// Hover state: amber left-rule via border-l-accent — the exchange signature element.
// Self-contained: does not import from card.tsx (macOS case-sensitivity rule).

function ShadCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('bg-bg-card text-text-primary flex flex-col rounded-[4px] border', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold text-text-primary', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-text-secondary text-xs', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-4', className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-4 [.border-t]:pt-4', className)}
      {...props}
    />
  );
}

function InlineSeparator({ className }: { className?: string }) {
  return (
    <div
      data-slot="separator"
      className={cn('shrink-0 bg-border-subtle h-px w-full', className)}
    />
  );
}

// ── App-layer Card ─────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  /** Show the amber left-rule always (not just on hover) */
  accentRule?: boolean;
}

export function Card({
  interactive = false,
  padding = 'md',
  accentRule = false,
  children,
  className,
  ...props
}: CardProps) {
  const paddingClass = {
    none: '',
    sm:   'p-3',
    md:   'p-4',
    lg:   'p-5',
  }[padding];

  return (
    <ShadCard
      className={cn(
        'gap-0 border-border-subtle bg-bg-card',
        paddingClass,
        accentRule && 'border-l-2 border-l-accent',
        interactive && [
          'cursor-pointer',
          'border-l-2 border-l-transparent',
          'hover:border-l-accent',
          'hover:bg-bg-card-hover',
          'transition-all duration-150',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </ShadCard>
  );
}

export function CardDivider({ className }: { className?: string }) {
  return <InlineSeparator className={cn('my-0', className)} />;
}
