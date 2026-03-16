/**
 * Typed API client for all auction-backend endpoints.
 * All functions return the unwrapped `data` field — callers never see the envelope.
 * Organised by module to mirror the backend module structure.
 */

import { config } from './config';
import { getAccessToken } from './supabase';
import type {
  ApiResponse,
  AuctionRow,
  AuctionStatus,
  LotRow,
  AuditLogRow,
  BidRow,
  BestBidResponse,
  VendorRow,
  VendorWithPerformance,
  InvitationRow,
  AgentRunRow,
  AuctionAlertRow,
  AwardRecommendationRow,
  AuctionAiMetadata,
  NotificationRow,
  LoginResponse,
  CurrentUser,
  CreateAuctionPayload,
  UpdateAuctionPayload,
  CreateLotPayload,
  ShortlistedVendor,
  AnalyzePriceIntelligencePayload,
  PriceIntelligenceSuggestion,
  CloseAuctionResponse,
} from './types';

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${config.apiUrl}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { error?: { message?: string } }).error?.message ??
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const envelope = (await res.json()) as ApiResponse<T>;
  return envelope.data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(): Promise<CurrentUser> {
    return apiFetch<CurrentUser>('/auth/me');
  },
};

// ─── Auctions ────────────────────────────────────────────────────────────────

export const auctionsApi = {
  list(): Promise<AuctionRow[]> {
    return apiFetch<AuctionRow[]>('/auctions');
  },

  get(id: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}`);
  },

  create(payload: CreateAuctionPayload): Promise<AuctionRow> {
    return apiFetch<AuctionRow>('/auctions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateAuctionPayload): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  publish(id: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/publish`, { method: 'PATCH' });
  },

  open(id: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/open`, { method: 'PATCH' });
  },

  close(id: string): Promise<CloseAuctionResponse> {
    return apiFetch<CloseAuctionResponse>(`/auctions/${id}/close`, { method: 'PATCH' });
  },

  forceClose(id: string): Promise<{ status: AuctionStatus }> {
    return apiFetch<{ status: AuctionStatus }>(`/auctions/${id}/force-close`, { method: 'PATCH' });
  },

  award(id: string, winningVendorId: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/award`, {
      method: 'PATCH',
      body: JSON.stringify({ winningVendorId }),
    });
  },

  extendByMinutes(id: string, minutes: number): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/extend`, {
      method: 'PATCH',
      body: JSON.stringify({ minutes }),
    });
  },

  cancel(id: string, reason: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  clone(id: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/clone`, { method: 'POST' });
  },

  pauseAuction(id: string, reason?: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  resumeAuction(id: string): Promise<AuctionRow> {
    return apiFetch<AuctionRow>(`/auctions/${id}/resume`, { method: 'POST' });
  },

  delete(id: string): Promise<void> {
    return apiFetch<void>(`/auctions/${id}`, { method: 'DELETE' });
  },
};

// ─── Lots ─────────────────────────────────────────────────────────────────────

export const lotsApi = {
  list(auctionId: string): Promise<LotRow[]> {
    return apiFetch<LotRow[]>(`/auctions/${auctionId}/lots`);
  },

  create(auctionId: string, payload: CreateLotPayload): Promise<LotRow> {
    return apiFetch<LotRow>(`/auctions/${auctionId}/lots`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    auctionId: string,
    lotId: string,
    payload: Partial<CreateLotPayload>,
  ): Promise<LotRow> {
    return apiFetch<LotRow>(`/auctions/${auctionId}/lots/${lotId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

// ─── Bids ─────────────────────────────────────────────────────────────────────

export const bidsApi = {
  submit(auctionId: string, amount: number): Promise<BidRow> {
    return apiFetch<BidRow>(`/auctions/${auctionId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  list(auctionId: string): Promise<BidRow[]> {
    return apiFetch<BidRow[]>(`/auctions/${auctionId}/bids`);
  },

  mine(auctionId: string): Promise<BidRow[]> {
    return apiFetch<BidRow[]>(`/auctions/${auctionId}/bids/mine`);
  },

  best(auctionId: string): Promise<BestBidResponse> {
    return apiFetch<BestBidResponse>(`/auctions/${auctionId}/bids/best`);
  },
};

// ─── Vendors (Buyer view) ─────────────────────────────────────────────────────

export const vendorsApi = {
  list(): Promise<VendorRow[]> {
    return apiFetch<VendorRow[]>('/vendors');
  },

  get(id: string): Promise<VendorWithPerformance> {
    return apiFetch<VendorWithPerformance>(`/vendors/${id}`);
  },
};

// ─── Vendor Invitations ───────────────────────────────────────────────────────

export const invitationsApi = {
  /** Buyer: list invitations for an auction */
  listForAuction(auctionId: string): Promise<InvitationRow[]> {
    return apiFetch<InvitationRow[]>(`/auctions/${auctionId}/invitations`);
  },

  /** Buyer: invite one or more vendors */
  invite(auctionId: string, vendorIds: string[]): Promise<void> {
    return apiFetch<void>(`/auctions/${auctionId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ vendorIds }),
    });
  },

  /** Buyer: revoke a vendor invitation. Matches backend DELETE /auctions/:auctionId/invitations/:vendorId */
  revoke(auctionId: string, vendorId: string): Promise<void> {
    return apiFetch<void>(`/auctions/${auctionId}/invitations/${vendorId}`, {
      method: 'DELETE',
    });
  },

  /** Vendor: list own invitations */
  mine(): Promise<InvitationRow[]> {
    return apiFetch<InvitationRow[]>('/vendor/invitations');
  },

  /** Vendor: accept or decline an invitation */
  respond(
    invitationId: string,
    status: 'ACCEPTED' | 'DECLINED',
  ): Promise<InvitationRow> {
    return apiFetch<InvitationRow>(
      `/vendor/invitations/${invitationId}/respond`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    );
  },
};

// ─── Vendor: own profile ──────────────────────────────────────────────────────

export const vendorProfileApi = {
  get(): Promise<VendorRow> {
    return apiFetch<VendorRow>('/vendor/profile');
  },

  update(payload: {
    company_name?: string;
    contact_name?: string;
    category_tags?: string[];
  }): Promise<VendorRow> {
    return apiFetch<VendorRow>('/vendor/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

// ─── Agents ───────────────────────────────────────────────────────────────────

export const agentsApi = {
  /** Manually trigger Price Intelligence for an auction. Returns immediately — agent runs async. */
  triggerPriceIntelligence(auctionId: string): Promise<{ triggered: true }> {
    return apiFetch<{ triggered: true }>(
      `/agents/price-intelligence/${auctionId}`,
      { method: 'POST' },
    );
  },

  analyzePriceIntelligence(
    payload: AnalyzePriceIntelligencePayload,
  ): Promise<PriceIntelligenceSuggestion> {
    return apiFetch<PriceIntelligenceSuggestion>('/agents/price-intelligence/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Fetch all agent runs for an auction (for the trace viewer). */
  runs(auctionId: string): Promise<AgentRunRow[]> {
    return apiFetch<AgentRunRow[]>(`/auctions/${auctionId}/agent-runs`);
  },

  /** Fetch all anomaly alerts raised during an auction. */
  alerts(auctionId: string): Promise<AuctionAlertRow[]> {
    return apiFetch<AuctionAlertRow[]>(`/auctions/${auctionId}/alerts`);
  },

  /** Fetch the award recommendation for a closed auction. */
  recommendation(auctionId: string): Promise<AwardRecommendationRow | null> {
    return apiFetch<AwardRecommendationRow | null>(
      `/auctions/${auctionId}/recommendation`,
    );
  },

  /** Fetch the latest price intelligence metadata for an auction. */
  priceMetadata(auctionId: string): Promise<AuctionAiMetadata | null> {
    return apiFetch<AuctionAiMetadata | null>(`/auctions/${auctionId}/price-metadata`);
  },

  /** Fetch the vendor shortlist recommendation for an auction. */
  shortlist(auctionId: string): Promise<ShortlistedVendor[]> {
    return apiFetch<{ shortlisted: ShortlistedVendor[] } | null>(
      `/auctions/${auctionId}/shortlist`,
    ).then((result) => result?.shortlisted ?? []);
  },
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const auditApi = {
  list(auctionId: string): Promise<AuditLogRow[]> {
    return apiFetch<AuditLogRow[]>(`/auctions/${auctionId}/audit`);
  },

  /**
   * Downloads the audit log as a CSV blob with the Authorization header attached.
   * Cannot use a plain <a href> because the browser never sends the JWT on
   * direct navigations — the backend would return 401.
   */
  async exportCsv(auctionId: string): Promise<void> {
    const token = await getAccessToken();
    const res = await fetch(`${config.apiUrl}/api/v1/auctions/${auctionId}/audit/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? `Export failed (HTTP ${res.status})`);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `audit-${auctionId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list(): Promise<NotificationRow[]> {
    return apiFetch<NotificationRow[]>('/notifications');
  },

  markRead(id: string): Promise<void> {
    return apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllRead(): Promise<void> {
    return apiFetch<void>('/notifications/read-all', { method: 'PATCH' });
  },
};
