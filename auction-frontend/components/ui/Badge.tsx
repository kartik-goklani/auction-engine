import { type HTMLAttributes } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'elevated';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  as?: 'span' | 'div';
  pulse?: boolean;
}

export const badgeVariants = cva(
  'inline-flex items-center gap-1 font-medium whitespace-nowrap tracking-wide uppercase',
  {
    variants: {
      variant: {
        default:  'text-text-muted bg-bg-elevated border border-border-subtle',
        success:  'text-[var(--success)] bg-[color-mix(in_oklch,var(--success)_12%,transparent)] border border-[color-mix(in_oklch,var(--success)_25%,transparent)]',
        danger:   'text-[var(--danger)] bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] border border-[color-mix(in_oklch,var(--danger)_25%,transparent)]',
        warning:  'text-[var(--warning)] bg-[color-mix(in_oklch,var(--warning)_12%,transparent)] border border-[color-mix(in_oklch,var(--warning)_25%,transparent)]',
        info:     'text-[var(--info)] bg-[color-mix(in_oklch,var(--info)_12%,transparent)] border border-[color-mix(in_oklch,var(--info)_25%,transparent)]',
        accent:   'text-accent bg-accent-dim border border-border-accent',
        elevated: 'text-text-secondary bg-bg-tag border border-border-subtle',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[9px] rounded-[2px]',
        md: 'px-2 py-0.5 text-[10px] rounded-[2px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export function Badge({
  variant = 'default',
  size = 'md',
  pulse,
  children,
  className,
  as: Tag = 'span',
  ...props
}: BadgeProps) {
  return (
    <Tag
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...(props as HTMLAttributes<HTMLSpanElement>)}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5 mr-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--success)]" />
        </span>
      )}
      {children}
    </Tag>
  );
}
