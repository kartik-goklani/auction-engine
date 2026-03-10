import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds subtle shadow lift on hover — use for interactive/clickable cards */
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const paddingClasses = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
};

export function Card({
  interactive = false,
  padding = 'md',
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-card rounded-2xl',
        'border border-border-subtle',
        'shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]',
        'transition-all duration-200',
        interactive && [
          'cursor-pointer',
          'hover:border-border-accent',
          'hover:shadow-[0_0_0_1px_rgba(168,85,247,0.20)]',
        ],
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Horizontal divider inside a card */
export function CardDivider({ className }: { className?: string }) {
  return (
    <hr className={cn('border-t border-border-subtle', className)} />
  );
}
