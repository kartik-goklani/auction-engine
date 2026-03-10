'use client';

import { useState, useEffect } from 'react';
import { vendorsApi } from '@/lib/api';
import type { VendorRow } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { VendorProfileModal } from '@/components/vendor/VendorProfileModal';
import { Building2, Search } from 'lucide-react';

export default function VendorsPage() {
  const [vendors,          setVendors]          = useState<VendorRow[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [search,           setSearch]           = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  useEffect(() => {
    vendorsApi
      .list()
      .then(setVendors)
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = vendors.filter(
    (v) =>
      v.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (v.category_tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  if (loading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Vendor Directory</h1>
          <p className="mt-1 text-sm text-text-muted">{vendors.length} vendors registered</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="w-full bg-bg-input text-text-primary text-sm pl-9 pr-4 py-2 rounded-lg border border-border-default placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={20} />}
          title="No vendors found"
          description="Try a different search term."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((vendor) => (
            <Card
              key={vendor.id}
              interactive
              onClick={() => setSelectedVendorId(vendor.id)}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated border border-border-subtle">
                  <Building2 size={15} className="text-text-muted" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {vendor.company_name}
                  </p>
                  {vendor.category_tags && vendor.category_tags.length > 0 && (
                    <p className="text-[10px] text-text-muted">{vendor.category_tags[0]}</p>
                  )}
                </div>
              </div>
              <div className="border-t border-border-subtle pt-2 flex items-center justify-between">
                <p className="text-[10px] text-text-muted">{vendor.email}</p>
                <p className="text-[10px] text-accent">View profile →</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VendorProfileModal
        vendorId={selectedVendorId}
        onClose={() => setSelectedVendorId(null)}
      />
    </div>
  );
}
