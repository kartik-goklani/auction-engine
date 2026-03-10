'use client';

import { useState, useEffect } from 'react';
import { vendorsApi } from '@/lib/api';
import type { VendorWithPerformance } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Building2, Mail, User, Tag, AlertTriangle, Star } from 'lucide-react';

interface VendorProfileModalProps {
  vendorId: string | null;
  onClose: () => void;
}

export function VendorProfileModal({ vendorId, onClose }: VendorProfileModalProps) {
  const [vendor,  setVendor]  = useState<VendorWithPerformance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId) { setVendor(null); return; }
    setLoading(true);
    vendorsApi
      .get(vendorId)
      .then(setVendor)
      .catch(() => setVendor(null))
      .finally(() => setLoading(false));
  }, [vendorId]);

  return (
    <Modal open={!!vendorId} onClose={onClose} title="Vendor Profile" size="md">
      {loading || !vendor ? (
        <div className="flex justify-center py-10">
          <Spinner size={20} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
              <Building2 size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-base font-semibold text-text-primary">{vendor.company_name}</p>
              <p className="text-xs text-text-muted capitalize">{vendor.status.toLowerCase()}</p>
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-bg-elevated border border-border-subtle p-3">
              <User size={13} className="text-text-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">Contact</p>
                <p className="text-xs font-medium text-text-primary truncate">{vendor.contact_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-bg-elevated border border-border-subtle p-3">
              <Mail size={13} className="text-text-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">Email</p>
                <p className="text-xs font-medium text-text-primary truncate">{vendor.email}</p>
              </div>
            </div>
          </div>

          {/* Category tags */}
          {vendor.category_tags && vendor.category_tags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={11} className="text-text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-text-muted">Categories</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vendor.category_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-bg-tag text-text-secondary text-[10px] font-medium px-2.5 py-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Performance scores */}
          {vendor.performance_scores.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={11} className="text-text-muted" />
                <p className="text-[10px] uppercase tracking-wider text-text-muted">Performance</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {vendor.performance_scores.map((score, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-bg-elevated border border-border-subtle px-3 py-2"
                  >
                    <p className="text-xs text-text-secondary">{score.category}</p>
                    <div className="flex items-center gap-4">
                      {score.delivery_success_rate != null && (
                        <div className="text-right">
                          <p className="text-[10px] text-text-muted">Delivery</p>
                          <p className="text-xs font-semibold text-text-primary">
                            {(score.delivery_success_rate * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                      {score.quality_score != null && (
                        <div className="text-right">
                          <p className="text-[10px] text-text-muted">Quality</p>
                          <p className="text-xs font-semibold text-text-primary">
                            {score.quality_score.toFixed(1)}
                          </p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-[10px] text-text-muted">Contracts</p>
                        <p className="text-xs font-semibold text-text-primary">{score.total_contracts}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active flags */}
          {vendor.active_flags.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-warning" />
                <p className="text-xs font-semibold text-warning">Active Flags</p>
              </div>
              {vendor.active_flags.map((flag, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-text-primary">{flag.flag_type}</p>
                  {flag.flag_reason && (
                    <p className="text-[10px] text-text-muted">{flag.flag_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
