import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class names safely, resolving conflicts.
 * Use this for all conditional/composed className strings.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a paise integer as an Indian Rupee string.
 * This is the ONLY place division by 100 is permitted on the frontend.
 * Never call this with a float — backend always sends integers.
 */
export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/**
 * Format an ISO 8601 UTC string into a human-readable local date+time.
 */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * Format an ISO 8601 UTC string as a compact relative time label
 * e.g. "2 min ago", "just now", "3 hr ago".
 */
export function formatTimeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin} min ago`;
  const diffHr  = Math.floor(diffMin / 60);
  if (diffHr  < 24)  return `${diffHr} hr ago`;
  return formatDate(iso);
}

/**
 * Return seconds remaining until an ISO 8601 end-time string.
 * Returns 0 if the time has already passed.
 */
export function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * Format a seconds count as MM:SS or HH:MM:SS for use in countdown timers.
 */
export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Anonymise a vendor ID into a stable display alias.
 * Produces e.g. "Vendor A", "Vendor B" — deterministic per ID.
 * Used in bid feeds where vendor identity must stay hidden.
 */
export function vendorAlias(vendorId: string, index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Vendor ${letter}`;
}

/**
 * Format an ISO 8601 UTC string into a high-precision local date+time string
 * that includes seconds and milliseconds. Used in audit trails where exact
 * event ordering matters.
 * Example output: "09 Mar 2026, 18:27:34.123"
 */
export function formatDatePrecise(iso: string): string {
  const d = new Date(iso);
  const base = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(d);
  return `${base}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}
