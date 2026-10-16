/** Labels and small formatting for the Conversions page. Pure, so it is unit-tested. */
import type { ConversionStatus, EventKind, MatchKey, Platform } from '@/features/conversions/types';

export type PlatformInfo = {
  label: string;
  /** What the platform calls the API Seentics sends through. */
  api: string;
  monogram: string;
  available: boolean;
};

/** Platforms on the connect screen, in order; the last two are not built yet. */
export const PLATFORMS: Record<Platform | 'tiktok' | 'linkedin', PlatformInfo> = {
  meta: { label: 'Meta', api: 'Conversions API', monogram: 'M', available: true },
  ga4: { label: 'Google Analytics 4', api: 'Measurement Protocol', monogram: 'GA', available: true },
  tiktok: { label: 'TikTok', api: 'Events API', monogram: 'TT', available: false },
  linkedin: { label: 'LinkedIn', api: 'Conversions API', monogram: 'in', available: false },
};

export const KIND_LABEL: Record<EventKind, string> = {
  purchase: 'Purchase',
  lead: 'Lead',
  sign_up: 'Sign-up',
  custom: 'Custom event',
};

/** What each kind is, in a few words, for the event mapping step. */
export const KIND_HINT: Record<Exclude<EventKind, 'custom'>, string> = {
  purchase: "seentics.track('purchase') and store orders, with value and order id",
  lead: 'Popup and form submissions, when the visitor ticked consent',
  sign_up: "seentics.track('sign_up')",
};

export const MATCH_LABEL: Record<MatchKey, string> = {
  click_id: 'Click ID',
  email: 'Email',
  phone: 'Phone',
  ip_ua: 'IP + browser',
  browser_id: 'Browser ID',
};

/** One line on what each key does for matching, for the match quality section. */
export const MATCH_HINT: Record<MatchKey, string> = {
  click_id: 'fbclid / gclid from the ad link — ties the sale to the exact click',
  email: 'Hashed before it leaves Seentics',
  phone: 'Hashed before it leaves Seentics',
  ip_ua: 'A weak hint the platforms use to back up the others',
  browser_id: 'The _fbp / _ga browser id, when the site runs the pixel or gtag',
};

export const STATUS_META: Record<ConversionStatus, { label: string; dot: string }> = {
  success: { label: 'Accepted', dot: 'bg-emerald-500' },
  pending: { label: 'Sending', dot: 'bg-muted-foreground/50' },
  failed: { label: 'Failed', dot: 'bg-rose-500' },
  skipped: { label: 'Not sent', dot: 'bg-muted-foreground/30' },
};

/** A share as a whole percentage; 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** A conversion's value with its currency, or an em dash when it has none. */
export function formatValue(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim();
  }
}

/** Whether a measurement id looks like GA4's ("G-" and letters/digits). */
export const isMeasurementId = (v: string) => /^G-[A-Z0-9]{4,}$/i.test(v.trim());
/** Whether a pixel id looks like Meta's (all digits, 10–20 long). */
export const isPixelId = (v: string) => /^\d{10,20}$/.test(v.trim());

/** The tip under match quality: only when email is the weak link worth fixing. */
export function matchTip(match: { total: number; email: number; click_id: number }): string | null {
  if (match.total < 5) return null;
  if (percent(match.email, match.total) < 50) {
    return "Fewer than half of your conversions carry an email. Send the buyer's email with the purchase to match more of them.";
  }
  return null;
}
