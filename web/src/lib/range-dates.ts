'use client';

import { useEffect, useState } from 'react';
import { useLocale, type Locale } from '@/lib/i18n';
import { uiEn } from '@/lib/i18n/messages/ui-en';
import { uiBn } from '@/lib/i18n/messages/ui-bn';

/** Short weekday and month names in `locale`; digits stay Latin in both. */
const names = (locale: Locale) => (locale === 'bn' ? uiBn : uiEn).dates;

/** "Sun, 27 Sep" / "রবি, 27 সেপ্টে". Built by hand: `toLocaleDateString` spells September "Sept" in en-GB. */
export function formatShortDate(d: Date, locale: Locale = 'en'): string {
  const { weekdays, months } = names(locale);
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

/** "27 Sep" — the compact form used inside a range. */
export function formatDayMonth(d: Date, locale: Locale = 'en'): string {
  return `${d.getDate()} ${names(locale).months[d.getMonth()]}`;
}

/** Two dates as a compact range: "27 Sep – 10 Oct". */
export function formatDateSpan(start: Date, end: Date, locale: Locale = 'en'): string {
  return `${formatDayMonth(start, locale)} – ${formatDayMonth(end, locale)}`;
}

/**
 * The calendar dates a rolling window of `days` covers, ending at `now`:
 * "27 Sep – 10 Oct". The weekday is left out of a range to keep the trigger small;
 * a single day carries it ("Sat, 10 Oct").
 */
export function formatRangeDates(days: number, now: Date = new Date(), locale: Locale = 'en'): string {
  if (days <= 0) return formatShortDate(now, locale);
  return formatDateSpan(new Date(now.getTime() - days * 86_400_000), now, locale);
}

/**
 * The window's dates for a range trigger, or `null` until mounted.
 *
 * The date comes from the clock, so rendering it on the server would disagree with the
 * browser around midnight and trip a hydration mismatch. Callers show the preset's own
 * label until this returns a string.
 */
export function useRangeDates(days: number): string | null {
  const { locale } = useLocale();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(days > 0 ? formatRangeDates(days, new Date(), locale) : null);
  }, [days, locale]);
  return text;
}
