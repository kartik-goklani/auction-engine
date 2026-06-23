'use client';

import * as React from 'react';
import { type ReactNode } from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '@/lib/utils';

// ── Exchange Tabs primitive ────────────────────────────────────────────────────
// Style: underline tabs, not pill tabs. Amber underline on active.
// Reads like a trading terminal section header, not a SaaS filter pill.
// Self-contained: does not import from tabs.tsx (macOS case-sensitivity rule).

export function TabsRoot({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-0', className)}
      {...props}
    />
  );
}

export function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'flex items-center border-b border-border-subtle gap-0',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative px-4 py-2.5 text-xs font-medium tracking-wide uppercase text-text-muted",
        "transition-colors duration-150 outline-none",
        "hover:text-text-primary",
        "focus-visible:ring-1 focus-visible:ring-border-accent",
        "disabled:pointer-events-none disabled:opacity-40",
        "data-selected:text-accent",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px]",
        "after:bg-transparent data-selected:after:bg-accent",
        "after:transition-colors after:duration-150",
        className,
      )}
      {...props}
    />
  );
}

// ── App-layer generic Tabs wrapper ─────────────────────────────────────────────

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

export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  return (
    <TabsRoot
      value={active}
      onValueChange={(v) => onChange(v as T)}
      className={cn('flex-row', className)}
    >
      <TabsList className="w-full">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
          >
            <span className="flex items-center gap-2">
              {tab.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--success)]" />
                </span>
              )}
              {tab.label}
              {tab.badge !== undefined && (
                <span className="text-[9px] font-semibold bg-bg-tag text-text-muted px-1.5 py-0.5 rounded-[2px] tracking-normal normal-case">
                  {tab.badge}
                </span>
              )}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  );
}
