import { en, type Messages } from './messages/en';

export type { Messages } from './messages/en';

/** Seentics speaks English only; kept as a type so date and number helpers name their locale. */
export type Locale = 'en';

const LOCALE_STATE = { locale: 'en' as Locale };

/** The page's language: always English. */
export const useLocale = () => LOCALE_STATE;

/** Every string the pages show. */
export const useT = (): Messages => en;

/** Dates as "October 20, 2026". */
export function formatDate(iso: string | null | undefined, _locale?: Locale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
