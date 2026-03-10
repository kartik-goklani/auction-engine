import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'elevated';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  as?: 'span' | 'div';
  pulse?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  'text-text-secondary bg-bg-elevated border border-border-subtle',
  success:  'text-success bg-success/10',
  danger:   'text-danger bg-danger/10',
  warning:  'text-warning bg-warning/10',
  info:     'text-accent-blue bg-accent-blue/10',
  accent:   'text-text-primary bg-bg-tag',
  elevated: 'text-text-secondary bg-bg-elevated border border-border-subtle',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

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
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...(props as HTMLAttributes<HTMLSpanElement>)}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5 mr-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
        </span>
      )}
      {children}
    </Tag>
  );
}
