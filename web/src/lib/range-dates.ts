'use client';

import { useEffect, useState } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sun, 27 Sep". Built by hand: `toLocaleDateString` spells September "Sept" in en-GB. */
export function formatShortDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "27 Sep" — the compact form used inside a range. */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Two dates as a compact range: "27 Sep – 10 Oct". */
export function formatDateSpan(start: Date, end: Date): string {
  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

/**
 * The calendar dates a rolling window of `days` covers, ending at `now`:
 * "27 Sep – 10 Oct". The weekday is left out of a range to keep the trigger small;
 * a single day carries it ("Sat, 10 Oct").
 */
export function formatRangeDates(days: number, now: Date = new Date()): string {
  if (days <= 0) return formatShortDate(now);
  return formatDateSpan(new Date(now.getTime() - days * 86_400_000), now);
}

/**
 * The window's dates for a range trigger, or `null` until mounted.
 *
 * The date comes from the clock, so rendering it on the server would disagree with the
 * browser around midnight and trip a hydration mismatch. Callers show the preset's own
 * label until this returns a string.
 */
export function useRangeDates(days: number): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(days > 0 ? formatRangeDates(days) : null);
  }, [days]);
  return text;
}
