'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'inputPrefix'> {
  label?: string;
  hint?: string;
  error?: string;
  /** Leading adornment rendered inside the input on the left */
  inputPrefix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, inputPrefix, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {inputPrefix && (
            <span className="absolute left-3 text-text-muted select-none">{inputPrefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-bg-input text-text-primary text-sm',
              'px-4 py-2.5 rounded-[10px]',
              'border border-border-subtle',
              'placeholder:text-text-muted',
              'focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(129,74,200,0.18)]',
              'transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              inputPrefix && 'pl-9',
              error && 'border-danger focus:border-danger',
              className,
            )}
            {...props}
          />
        </div>
        {hint && !error && (
          <p className="text-[11px] text-text-muted">{hint}</p>
        )}
        {error && (
          <p className="text-[11px] text-danger">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
