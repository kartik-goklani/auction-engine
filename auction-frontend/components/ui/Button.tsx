'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--inverse-control-bg)] text-[var(--inverse-control-text)] font-semibold border border-[var(--inverse-control-border)] ' +
    'shadow-[var(--inverse-control-shadow)] ' +
    'hover:bg-[var(--inverse-control-hover-bg)] hover:shadow-[var(--inverse-control-shadow-hover)] ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100',
  secondary:
    'bg-transparent text-text-primary font-semibold border border-border-subtle ' +
    'hover:border-border-accent hover:bg-bg-elevated ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
  ghost:
    'bg-transparent text-text-secondary font-medium ' +
    'hover:bg-bg-elevated hover:text-text-primary ' +
    'disabled:opacity-40 disabled:cursor-not-allowed',
  danger:
    'bg-danger/10 text-danger font-semibold border border-danger/30 ' +
    'hover:bg-danger/20 ' +
    'active:scale-[0.97] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-full gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-full gap-2',
  lg: 'px-6 py-3   text-sm rounded-full gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, children, className, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150 ease-out whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
