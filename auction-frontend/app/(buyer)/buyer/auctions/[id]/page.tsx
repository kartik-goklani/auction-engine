'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auctionsApi, vendorsApi, invitationsApi, agentsApi } from '@/lib/api';
import type { AuctionRow, VendorRow, InvitationRow, UpdateAuctionPayload, ShortlistedVendor } from '@/lib/types';
import { AuctionStatus, AuctionType } from '@/lib/types';
import { AuctionStatusBadge } from '@/components/auction/AuctionStatusBadge';
import { AuctionTypeTag } from '@/components/auction/AuctionTypeTag';
import { AuctionTimer } from '@/components/auction/AuctionTimer';
import { VendorInviteRow } from '@/components/vendor/VendorInviteRow';
import { VendorList } from '@/components/vendor/VendorList';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Play, Gavel, UserPlus, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use local-time methods so the input reflects the user's timezone, not UTC
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Edit form state ───────────────────────────────────────────────────────────

interface EditForm {
  title:            string;
  description:      string;
  quantity:         string;
  unit:             string;
  ceilingPriceRupees: string;
  minDecrementRupees: string;
  startTime:        string;
  endTime:          string;
}

function auctionToEditForm(a: AuctionRow): EditForm {
  return {
    title:              a.title,
    description:        a.description ?? '',
    quantity:           String(a.quantity),
    unit:               a.unit,
    ceilingPriceRupees: toRupees(a.ceiling_price),
    minDecrementRupees: toRupees(a.min_decrement),
    startTime:          toDatetimeLocal(a.start_time),
    endTime:            toDatetimeLocal(a.end_time),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AuctionDetailPage() {
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();
  const [auction,       setAuction]       = useState<AuctionRow | null>(null);
  const [invitations,   setInvitations]   = useState<InvitationRow[]>([]);
  const [vendors,       setVendors]       = useState<VendorRow[]>([]);
  const [allVendors,    setAllVendors]    = useState<VendorRow[]>([]);
  const [inviteOpen,    setInviteOpen]    = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [editForm,      setEditForm]      = useState<EditForm | null>(null);
  const [selected,         setSelected]         = useState<Set<string>>(new Set());
  const [shortlist,        setShortlist]        = useState<ShortlistedVendor[]>([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [shortlistTimedOut, setShortlistTimedOut] = useState(false);
  const [inviteTab,        setInviteTab]        = useState<'ai' | 'all'>('ai');
  const [deleteConfirm,    setDeleteConfirm]    = useState(false);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [loading,          setLoading]          = useState(true);
  const shortlistPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [actionLoading,    setActionLoading]    = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [saveError,        setSaveError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, inv, v] = await Promise.all([
      auctionsApi.get(id),
      invitationsApi.listForAuction(id),
      vendorsApi.list(),
    ]);
    setAuction(a);
    setInvitations(inv);
    setVendors(v);
    setAllVendors(v);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  function openEdit() {
    if (!auction) return;
    setEditForm(auctionToEditForm(auction));
    setSaveError(null);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editForm) return;
    if (editForm.startTime && new Date(editForm.startTime) <= new Date()) {
      setSaveError('Start time must be in the future.');
      return;
    }
    if (!Number.isFinite(Number(editForm.quantity)) || Number(editForm.quantity) <= 0) {
      setSaveError('Quantity must be greater than zero.');
      return;
    }
    if (!editForm.unit.trim()) {
      setSaveError('Unit is required.');
      return;
    }
    if (editForm.startTime && editForm.endTime && new Date(editForm.endTime) <= new Date(editForm.startTime)) {
      setSaveError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload: UpdateAuctionPayload = {
        title:       editForm.title,
        description: editForm.description || undefined,
        quantity: Number(editForm.quantity),
        unit: editForm.unit.trim(),
        ceilingPrice: Math.round(parseFloat(editForm.ceilingPriceRupees) * 100),
        minDecrement: Math.round(parseFloat(editForm.minDecrementRupees) * 100),
        startTime:   editForm.startTime ? new Date(editForm.startTime).toISOString() : undefined,
        endTime:     editForm.endTime   ? new Date(editForm.endTime).toISOString()   : undefined,
      };
      await auctionsApi.update(id, payload);
      setEditOpen(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setActionLoading(true);
    try {
      await auctionsApi.publish(id);
      await load();
      openInviteModal();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevoke(auctionId: string, vendorId: string) {
    await invitationsApi.revoke(auctionId, vendorId);
    await load();
  }

  async function handleInvite() {
    if (shortlistPollRef.current) {
      clearInterval(shortlistPollRef.current);
      shortlistPollRef.current = null;
    }
    await invitationsApi.invite(id, Array.from(selected));
    setInviteOpen(false);
    setSelected(new Set());
    await load();
  }

  function openInviteModal() {
    setInviteTab('ai');
    setSelected(new Set());
    setShortlistTimedOut(false);
    setInviteOpen(true);
    setShortlistLoading(true);

    void agentsApi.shortlist(id)
      .then((data) => {
        setShortlist(data);
        setShortlistLoading(false);
        if (data.length === 0) {
          startShortlistPolling();
        }
      })
      .catch(() => {
        setShortlist([]);
        setShortlistLoading(false);
        startShortlistPolling();
      });
  }

  function startShortlistPolling() {
    if (shortlistPollRef.current) clearInterval(shortlistPollRef.current);
    let attempts = 0;
    shortlistPollRef.current = setInterval(() => {
      attempts++;
      if (attempts >= 10) {
        clearInterval(shortlistPollRef.current!);
        shortlistPollRef.current = null;
        setShortlistTimedOut(true);
        return;
      }
      void agentsApi.shortlist(id).then((data) => {
        if (data.length > 0) {
          setShortlist(data);
          clearInterval(shortlistPollRef.current!);
          shortlistPollRef.current = null;
        }
      }).catch(() => undefined);
    }, 3_000);
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await auctionsApi.delete(id);
      router.push('/buyer/auctions');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(false);
    }
  }

  function toggleSelect(v: VendorRow) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(v.id) ? next.delete(v.id) : next.add(v.id);
      return next;
    });
  }

  const vendorMap  = new Map(vendors.map((v) => [v.id, v]));
  const invitedIds = new Set(invitations.map((i) => i.vendor_id));
  const uninvited  = allVendors.filter((v) => !invitedIds.has(v.id));

  if (loading || !auction) return <FullPageSpinner />;

  const isDraft     = auction.status === AuctionStatus.DRAFT;
  const isPublished = auction.status === AuctionStatus.PUBLISHED;
  const isOpen      = auction.status === AuctionStatus.OPEN;
  const isEditable  = isDraft || isPublished;
  const isForward   = auction.type === AuctionType.FORWARD;
  const canDelete   =
    isDraft ||
    (isPublished &&
      auction.start_time != null &&
      new Date(auction.start_time) > new Date(Date.now() + 60 * 60 * 1_000));

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/buyer/auctions">
          <button type="button" className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <ArrowLeft size={16} />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-text-primary truncate">{auction.title}</h1>
            <AuctionTypeTag type={auction.type} />
            <AuctionStatusBadge status={auction.status} pulse />
          </div>
          {auction.description && (
            <p className="mt-0.5 text-xs text-text-muted">{auction.description}</p>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Quantity',
            value: `${auction.quantity} ${auction.unit}`,
          },
          {
            label: isForward ? 'Floor Price' : 'Ceiling Price',
            value: formatCurrency(auction.ceiling_price),
          },
          {
            label: isForward ? 'Min Increment' : 'Min Decrement',
            value: formatCurrency(auction.min_decrement),
          },
          { label: 'Visibility', value: auction.visibility },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-bg-card border border-border-subtle p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-bg-card border border-border-subtle p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Starts</p>
          <p className="mt-0.5 text-xs font-medium text-text-secondary">
            {auction.start_time ? formatDate(auction.start_time) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-bg-card border border-border-subtle p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            {isOpen ? 'Time Left' : 'Ends'}
          </p>
          <div className="mt-0.5">
            {isOpen && auction.end_time ? (
              <AuctionTimer endTime={auction.end_time} />
            ) : (
              <p className="text-xs font-medium text-text-secondary">
                {auction.end_time ? formatDate(auction.end_time) : '—'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {isDraft && (
          <Button variant="primary" size="md" loading={actionLoading} onClick={handlePublish}>
            <Play size={14} />
            Publish Auction
          </Button>
        )}
        {isOpen && (
          <Link href={`/buyer/auctions/${id}/live`}>
            <Button variant="primary" size="md">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Open Live Room
            </Button>
          </Link>
        )}
        {(auction.status === AuctionStatus.CLOSED || auction.status === AuctionStatus.AWARDED) && (
          <Link href={`/buyer/auctions/${id}/results`}>
            <Button variant="secondary" size="md">
              <Gavel size={14} />
              View Results
            </Button>
          </Link>
        )}
        <Link href={`/buyer/auctions/${id}/audit`}>
          <Button variant="secondary" size="md">Audit Trail</Button>
        </Link>
        {isEditable && (
          <Button variant="secondary" size="md" onClick={openEdit}>
            <Pencil size={13} />
            Edit Auction
          </Button>
        )}
        {canDelete && !deleteConfirm && (
          <Button variant="secondary" size="md" onClick={() => setDeleteConfirm(true)}>
            <Trash2 size={13} />
            Delete
          </Button>
        )}
        {deleteConfirm && (
          <div className="flex items-center gap-2">
            <Button variant="primary" size="md" loading={deleteLoading} onClick={handleDelete}
              className="bg-danger border-danger/50 shadow-none hover:bg-danger/90 text-white">
              Confirm Delete
            </Button>
            <Button variant="secondary" size="md" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Vendor invitations — hidden on DRAFT */}
      {!isDraft && <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Invited Vendors</h2>
            <p className="text-xs text-text-muted mt-0.5">{invitations.length} invitation{invitations.length !== 1 ? 's' : ''}</p>
          </div>
          {!isDraft && !isOpen && auction.status !== AuctionStatus.CLOSED && auction.status !== AuctionStatus.AWARDED && (
            <Button variant="secondary" size="sm" onClick={openInviteModal}>
              <UserPlus size={13} />
              Invite Vendors
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {invitations.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">No vendors invited yet.</p>
          ) : (
            invitations.map((inv) => (
              <VendorInviteRow
                key={inv.id}
                invitation={inv}
                vendor={vendorMap.get(inv.vendor_id)}
                onRevoke={isDraft || isPublished ? handleRevoke : undefined}
              />
            ))
          )}
        </div>
      </Card>}

      {/* ── Edit auction modal ──────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={isPublished ? 'Edit Auction — Accepted vendors will be notified' : 'Edit Auction'}
        size="md"
      >
        {editForm && (
          <div className="flex flex-col gap-4">
            {isPublished && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
                <p className="text-xs text-warning">
                  This auction is <strong>Published</strong>. Vendors who accepted the invitation
                  will receive an in-app notification about these changes.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Title</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
                className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Quantity</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Unit</label>
                <input
                  value={editForm.unit}
                  onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  {isForward ? 'Floor Price (₹)' : 'Ceiling Price (₹)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.ceilingPriceRupees}
                  onChange={(e) => setEditForm({ ...editForm, ceilingPriceRupees: e.target.value })}
                  className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  {isForward ? 'Min Increment (₹)' : 'Min Decrement (₹)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.minDecrementRupees}
                  onChange={(e) => setEditForm({ ...editForm, minDecrementRupees: e.target.value })}
                  className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Start Time</label>
                <input
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">End Time</label>
                <input
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="w-full bg-bg-input text-text-primary text-sm px-3 py-2 rounded-lg border border-border-default focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(124,92,252,0.20)] transition-all duration-200"
                />
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-danger">{saveError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-subtle">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          if (shortlistPollRef.current) {
            clearInterval(shortlistPollRef.current);
            shortlistPollRef.current = null;
          }
          setInviteOpen(false);
          setSelected(new Set());
        }}
        title="Invite Vendors"
        size="md"
      >
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-bg-elevated p-1 rounded-lg">
            {(['ai', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setInviteTab(tab)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  inviteTab === tab
                    ? 'bg-bg-card text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab === 'ai'
                  ? `AI Shortlist${shortlist.length > 0 ? ` (${shortlist.length})` : ''}`
                  : 'All Vendors'}
              </button>
            ))}
          </div>

          {inviteTab === 'ai' ? (
            shortlistLoading ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <Spinner size={16} />
                <span className="text-xs text-text-muted">Loading AI recommendations…</span>
              </div>
            ) : shortlist.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                {!shortlistTimedOut && <Spinner size={14} />}
                <p className="text-xs text-text-muted text-center">
                  {shortlistTimedOut
                    ? 'No shortlist available. Switch to All Vendors to invite manually.'
                    : 'AI shortlist is being generated — checking every few seconds…'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {shortlist.map((v) => {
                  const isInvited  = invitedIds.has(v.vendor_id);
                  const isSelected = selected.has(v.vendor_id);
                  const tierCls =
                    v.tier === 'PREFERRED' ? 'text-success bg-success/10 border-success/20' :
                    v.tier === 'CAUTION'   ? 'text-warning bg-warning/10 border-warning/20' :
                                             'text-text-secondary bg-bg-elevated border-border-subtle';
                  return (
                    <button
                      key={v.vendor_id}
                      type="button"
                      disabled={isInvited}
                      onClick={() => {
                        if (isInvited) return;
                        setSelected((prev) => {
                          const next = new Set(prev);
                          next.has(v.vendor_id) ? next.delete(v.vendor_id) : next.add(v.vendor_id);
                          return next;
                        });
                      }}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                        isInvited   ? 'opacity-50 cursor-default border-border-subtle bg-bg-card' :
                        isSelected  ? 'border-accent/50 bg-accent/5' :
                                      'border-border-subtle bg-bg-card hover:border-accent/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-accent border-accent' : 'border-border-default'}`}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-text-primary">{v.company_name}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierCls}`}>{v.tier}</span>
                          <span className="ml-auto text-xs font-mono text-text-secondary">{v.score}/100</span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{v.reason}</p>
                        {isInvited && (
                          <span className="text-[10px] text-text-muted">Already invited</span>
                        )}
                        {v.caution_flags.length > 0 && (
                          <p className="text-[10px] text-warning mt-0.5">{v.caution_flags.join(' · ')}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <VendorList vendors={uninvited} selectedIds={selected} onSelect={toggleSelect} />
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-subtle">
            <Button variant="secondary" size="sm" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selected.size === 0}
              onClick={handleInvite}
            >
              Invite {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
