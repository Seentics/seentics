/** Platform facts and small formatting for the Conversions page. Pure, so it is unit-tested. Words are in `useT().conversions`. */
import type { ConversionStatus, Platform } from '@/features/conversions/types';

export type PlatformInfo = {
  label: string;
  /** What the platform calls the API Seentics sends through. */
  api: string;
  /** Whether a test event can be sent without it counting (Meta and TikTok take a test code). */
  testCode: boolean;
};

/** Platforms on the connect screen, in order. */
export const PLATFORMS: Record<Platform, PlatformInfo> = {
  meta: { label: 'Meta', api: 'Conversions API', testCode: true },
  ga4: { label: 'Google Analytics 4', api: 'Measurement Protocol', testCode: false },
  tiktok: { label: 'TikTok', api: 'Events API', testCode: true },
  linkedin: { label: 'LinkedIn', api: 'Conversions API', testCode: false },
};

export const PLATFORM_ORDER: readonly Platform[] = ['meta', 'ga4', 'tiktok', 'linkedin'];

/** A custom event example in each platform's own vocabulary, for the mapping step. */
export const CUSTOM_EXAMPLE: Record<Platform, string> = {
  meta: 'InitiateCheckout',
  ga4: 'begin_checkout',
  tiktok: 'InitiateCheckout',
  linkedin: '104000123',
};

/** Each status's dot; labels are `conversions.statuses`. */
export const STATUS_META: Record<ConversionStatus, { dot: string }> = {
  success: { dot: 'bg-emerald-500' },
  pending: { dot: 'bg-muted-foreground/50' },
  failed: { dot: 'bg-rose-500' },
  skipped: { dot: 'bg-muted-foreground/30' },
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
/** Whether a pixel id looks like TikTok's (letters and digits, like C4ABCD1234EFGH5678). */
export const isTiktokPixel = (v: string) => /^[A-Z0-9]{10,40}$/i.test(v.trim());
/** Whether an id is a LinkedIn number: an ad account or a conversion rule. */
export const isLinkedinId = (v: string) => /^\d{5,20}$/.test(v.trim());

/** The tip under match quality: only when email is the weak link worth fixing. */
export function matchTip(
  match: { total: number; email: number; click_id: number },
  tip = "Fewer than half of your conversions carry an email. Send the buyer's email with the purchase to match more of them.",
): string | null {
  if (match.total < 5) return null;
  if (percent(match.email, match.total) < 50) return tip;
  return null;
}
