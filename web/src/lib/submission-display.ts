/**
 * How a form submission is shown, as pure functions.
 *
 * Kept apart from the components so the rules — what an avatar says, how a long URL is
 * shortened, how a submission's deliveries are summarised — are tested without rendering.
 */
import type { SubmissionDelivery } from '@/features/leads/types';

/** Up to two letters for an avatar: first and last word of the name, else the email's local part. */
export function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (email.split('@')[0] ?? '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
}

const AVATAR_TONES = [
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  'bg-violet-500/15 text-violet-600 dark:text-violet-300',
] as const;

/** The same address always gets the same colour, so a person is recognisable across rows. */
export function avatarTone(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** `https://example.com/pricing?x=1` → `/pricing`. Falls back to the input when it is not a URL. */
export function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url || '';
  }
}

/** `https://www.google.com/search` → `google.com`; empty for no referrer (direct). */
export function hostOf(referrer: string): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return referrer;
  }
}

/** `company_name` → `Company name`. */
export function humanizeKey(key: string): string {
  const text = key.replace(/[_-]+/g, ' ').trim();
  return text ? text[0]!.toUpperCase() + text.slice(1) : key;
}

export type DeliveryCounts = { delivered: number; pending: number; failed: number; skipped: number };

/** How many of a submission's deliveries are in each state. */
export function countDeliveries(deliveries: readonly Pick<SubmissionDelivery, 'status'>[]): DeliveryCounts {
  const counts: DeliveryCounts = { delivered: 0, pending: 0, failed: 0, skipped: 0 };
  for (const d of deliveries) {
    if (d.status === 'success') counts.delivered++;
    else counts[d.status]++;
  }
  return counts;
}

/** The one-line meaning of a submission's deliveries, worst news first. */
export function deliverySummary(deliveries: readonly Pick<SubmissionDelivery, 'status'>[]): string {
  if (deliveries.length === 0) return 'Not sent anywhere';
  const c = countDeliveries(deliveries);
  if (c.failed > 0) return `${c.failed} failed`;
  if (c.pending > 0) return `${c.pending} waiting`;
  if (c.delivered > 0) return c.skipped > 0 ? `${c.delivered} sent, ${c.skipped} skipped` : `${c.delivered} sent`;
  return `${c.skipped} skipped`;
}

/** The variant that collected the most submissions, for the stat card. */
export function topVariant(byVariant: readonly { variant: string | null; count: number }[]): { label: string; count: number } | null {
  const named = byVariant.filter((v) => v.variant);
  if (named.length === 0) return null;
  const best = named.reduce((a, b) => (b.count > a.count ? b : a));
  return { label: `Variant ${best.variant!.toUpperCase()}`, count: best.count };
}
