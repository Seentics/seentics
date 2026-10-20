/** Date, time and compact-number formatting for revenue views. Pure. */
import type { Locale } from '@/lib/i18n/locale';

/** The Intl locale for the app's language: Bangla keeps Latin digits. */
const intl = (locale?: Locale) => (locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined);

export function fmtDate(iso: string, locale?: Locale) {
  try { return new Date(iso).toLocaleDateString(intl(locale), { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

export function fmtTime(iso: string, locale?: Locale, dateStyle: 'medium' | 'full' = 'medium') {
  try { return new Date(iso).toLocaleString(intl(locale), { dateStyle, timeStyle: 'short' }); }
  catch { return iso; }
}

export function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
