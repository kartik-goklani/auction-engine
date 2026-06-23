import type { VendorRow } from '@/lib/types';
import { Building2, Star } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

interface VendorListProps {
  vendors: VendorRow[];
  onSelect?: (vendor: VendorRow) => void;
  selectedIds?: Set<string>;
}

export function VendorList({ vendors, onSelect, selectedIds }: VendorListProps) {
  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={<Building2 size={20} />}
        title="No vendors found"
        description="Try adjusting your search or filters."
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {vendors.map((vendor) => {
        const selected = selectedIds?.has(vendor.id);
        return (
          <button
            key={vendor.id}
            type="button"
            onClick={() => onSelect?.(vendor)}
            className={cn(
              'flex items-center justify-between w-full text-left px-4 py-3 rounded-[4px]',
              'border transition-colors duration-150',
              selected
                ? 'bg-accent/8 border-border-accent'
                : 'bg-bg-elevated border-border-subtle hover:border-border-default',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-bg-card border border-border-subtle">
                <Building2 size={14} className="text-text-muted" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {vendor.company_name}
                </p>
                {vendor.category_tags?.[0] && (
                  <p className="text-[10px] text-text-muted">{vendor.category_tags?.[0]}</p>
                )}
              </div>
            </div>
            {false && (
              <div className="flex shrink-0 items-center gap-1 text-warning">
                <Star size={11} className="fill-warning" />
                <span className="text-xs font-semibold">—</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
