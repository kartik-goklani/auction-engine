import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-xs font-medium tracking-wide uppercase text-text-muted select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  inputPrefix?: string;
}

export function FormInput({
  label,
  hint,
  error,
  inputPrefix,
  className,
  id,
  ...props
}: FormInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <Label htmlFor={inputId} className={cn(error && 'text-danger')}>
          {label}
        </Label>
      )}
      <div className="relative flex items-center">
        {inputPrefix && (
          <span className="absolute left-3 text-text-muted text-sm pointer-events-none select-none font-mono">
            {inputPrefix}
          </span>
        )}
        <Input
          id={inputId}
          className={cn(
            inputPrefix && 'pl-8',
            error && 'border-danger ring-1 ring-danger/20',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
