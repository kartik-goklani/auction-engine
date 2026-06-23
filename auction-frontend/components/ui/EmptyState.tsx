import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex h-10 w-10 items-center justify-center border border-border-default text-text-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-text-primary tracking-tight">{title}</p>
      {description && (
        <p className="mt-1.5 text-xs text-text-muted max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
