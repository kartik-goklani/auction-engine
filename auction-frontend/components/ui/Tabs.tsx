'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Tab<T extends string> {
  id: T;
  label: ReactNode;
  badge?: string | number;
  pulse?: boolean;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 bg-bg-elevated border border-border-subtle rounded-full p-1',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150',
            active === tab.id
              ? 'text-text-primary bg-bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-border-subtle'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          <span className="flex items-center gap-2">
            {tab.pulse && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
            )}
            {tab.label}
            {tab.badge !== undefined && (
              <span className="text-[10px] font-semibold bg-bg-tag text-text-secondary px-1.5 py-0.5 rounded-full">
                {tab.badge}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
