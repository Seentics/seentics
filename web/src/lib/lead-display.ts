/**
 * How a contact and its submissions are shown, as pure functions.
 *
 * Kept apart from the components so the rules — what an avatar says, which answers are a
 * prize rather than a form field, how a long URL is shortened — are tested without rendering.
 */
import type { ContactSubmission } from '@/features/leads/types';

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

/** The same address always gets the same colour, so a contact is recognisable across screens. */
export function avatarTone(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** `https://example.com/pricing?x=1` → `/pricing`. Falls back to the input when it is not a URL. */
export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || '/';
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

export type Answers = {
  /** What a wheel awarded, with its code when it has one. */
  prize: { label: string; code: string } | null;
  /** Every other form answer, in the order submitted. */
  rest: [string, string][];
};

/**
 * Split a submission's answers into the prize and the ordinary fields.
 *
 * `prize` and `coupon_code` are written by the server when a wheel or coupon pays out; they
 * read as a reward, not as something the visitor typed, so they are shown apart.
 */
export function splitAnswers(fields: ContactSubmission['fields']): Answers {
  const entries = Object.entries(fields).map(([k, v]) => [k, String(v)] as [string, string]);
  const label = entries.find(([k]) => k === 'prize')?.[1] ?? '';
  const code = entries.find(([k]) => k === 'coupon_code')?.[1] ?? '';
  const rest = entries.filter(([k]) => k !== 'prize' && k !== 'coupon_code');
  return { prize: label || code ? { label, code } : null, rest };
}

/** `company_name` → `Company name`. */
export function humanizeKey(key: string): string {
  const text = key.replace(/[_-]+/g, ' ').trim();
  return text ? text[0]!.toUpperCase() + text.slice(1) : key;
}
