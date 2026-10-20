'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiUrl } from '@/lib/config';
import { isEnterprise } from '@/lib/features';
import { readLocaleCookie, writeLocaleCookie, type Locale } from './locale';
import { bn } from './messages/bn';
import { en, type Messages } from './messages/en';
import { fetchRegion, type Region } from './region';

export { LOCALES, type Locale } from './locale';
export { offersManualPayments, type ManualPaymentMethod, type ManualPaymentMethodId, type Region } from './region';
export type { Messages } from './messages/en';

const MESSAGES: Record<Locale, Messages> = { en, bn };

const SYNCED_KEY = 'seentics_locale_synced';

/**
 * Tells the gateway the signed-in user's language, which their email is written in
 * (PUT /user/users/locale). Signed out it answers 401, which is fine: nothing to keep.
 * Fire and forget: the page's language never waits on it.
 */
function saveUserLocale(locale: Locale): void {
  if (!isEnterprise) return;
  void fetch(getApiUrl('/user/users/locale'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  })
    .then((res) => {
      if (!res.ok) return;
      try {
        sessionStorage.setItem(SYNCED_KEY, locale);
      } catch {
        // not remembered: sent again next page load
      }
    })
    .catch(() => undefined);
}

/** Whether this browser session already told the gateway `locale`. */
function alreadySaved(locale: Locale): boolean {
  try {
    return sessionStorage.getItem(SYNCED_KEY) === locale;
  } catch {
    return false;
  }
}

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /**
   * A page's own default language (the f-commerce page is Bangla), used only while the visitor has
   * not chosen one: not written to the cookie, so it never follows them to other pages.
   */
  preferLocale: (locale: Locale) => void;
  /** Null until the gateway has answered (and always on a self-hosted install, which has no billing). */
  region: Region | null;
};

// Without a provider (a test rendering one component), everything is English and there is no region.
const LocaleContext = createContext<LocaleState>({ locale: 'en', setLocale: () => {}, preferLocale: () => {}, region: null });

/**
 * The language and region for every page. The static export renders English; once mounted the
 * visitor's choice (the cookie) or their region (Bangladesh → Bangla) takes over.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    const chosen = readLocaleCookie();
    if (chosen) setLocaleState(chosen);
    // A choice made before signing in, or before email followed it: the dashboard passes it on once.
    if (chosen && window.location.pathname.startsWith('/websites') && !alreadySaved(chosen)) saveUserLocale(chosen);
    if (!isEnterprise) return;
    let live = true;
    void fetchRegion().then((r) => {
      if (!live) return;
      setRegion(r);
      if (!chosen && r.region === 'bd') setLocaleState('bn');
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    writeLocaleCookie(next);
    setLocaleState(next);
    saveUserLocale(next);
  }, []);

  const preferLocale = useCallback((preferred: Locale) => {
    if (!readLocaleCookie()) setLocaleState(preferred);
  }, []);

  const value = useMemo(() => ({ locale, setLocale, preferLocale, region }), [locale, setLocale, preferLocale, region]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** The current language's strings. */
export const useT = (): Messages => MESSAGES[useContext(LocaleContext).locale];

/** Dates as the current language writes them, digits Latin in both: "October 20, 2026" / "20 অক্টোবর, 2026". */
export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
