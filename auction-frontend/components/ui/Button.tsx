'use client';

import { forwardRef } from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium tracking-wide transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-border-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-accent text-[#0A0A0A] hover:bg-accent-hover border border-transparent",
        secondary:   "bg-transparent text-text-primary border border-border-default hover:border-border-accent hover:text-accent",
        outline:     "bg-transparent text-text-secondary border border-border-default hover:text-text-primary hover:border-border-default",
        ghost:       "bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary border border-transparent",
        destructive: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
        link:        "text-accent underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default:   "h-8 px-3 py-1.5 rounded-[4px]",
        xs:        "h-6 px-2 text-xs rounded-[3px]",
        sm:        "h-7 px-2.5 text-xs rounded-[4px]",
        lg:        "h-9 px-4 rounded-[4px]",
        icon:      "size-8 rounded-[4px]",
        "icon-xs": "size-6 rounded-[3px]",
        "icon-sm": "size-7 rounded-[4px]",
        "icon-lg": "size-9 rounded-[4px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type Variant = 'default' | 'secondary' | 'ghost' | 'destructive';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<VariantProps<typeof buttonVariants>, 'variant' | 'size'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantMap: Record<Variant, 'default' | 'secondary' | 'ghost' | 'destructive'> = {
  default:     'default',
  secondary:   'secondary',
  ghost:       'ghost',
  destructive: 'destructive',
};

const sizeOverride: Record<Size, string> = {
  sm: 'h-auto px-3 py-1.5 text-xs rounded-[3px]',
  md: 'h-auto px-4 py-2 text-sm rounded-[4px]',
  lg: 'h-auto px-5 py-2.5 text-sm rounded-[4px]',
};

const shadSizeMap: Record<Size, 'sm' | 'default' | 'lg'> = {
  sm:  'sm',
  md:  'default',
  lg:  'lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', loading, children, className, disabled, ...props }, ref) => (
    <ButtonPrimitive
      ref={ref}
      disabled={disabled ?? loading}
      className={cn(
        buttonVariants({ variant: variantMap[variant], size: shadSizeMap[size] }),
        sizeOverride[size],
        loading && 'gap-2',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </ButtonPrimitive>
  ),
);

Button.displayName = 'Button';
