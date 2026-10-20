/**
 * Which language the pages speak: English or Bangla.
 *
 * The visitor's own choice is a cookie, `seentics_locale`, set on the parent domain
 * (`.seentics.com`) so the sign-in pages (auth/web, another app on another subdomain) read the
 * same choice. Without one, a visitor in Bangladesh (the gateway's GET /billing/region) gets
 * Bangla, everyone else English. auth/web keeps its own copy of this file: the apps share no code.
 */

export type Locale = 'en' | 'bn';

export const LOCALES: readonly Locale[] = ['en', 'bn'];
export const LOCALE_COOKIE = 'seentics_locale';
const YEAR_SECONDS = 365 * 24 * 60 * 60;

export const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'bn';

/**
 * The domain the cookie is shared on: the last two labels of the host (`app.seentics.com` →
 * `.seentics.com`). Null for localhost and bare IP addresses, where a cookie must be host-only.
 */
export function cookieDomain(hostname: string): string | null {
  if (!hostname || hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;
  const labels = hostname.split('.');
  return labels.length >= 2 ? `.${labels.slice(-2).join('.')}` : null;
}

/** The visitor's chosen language, or null when they have not chosen one. */
export function readLocaleCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : null;
}

export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const domain = cookieDomain(window.location.hostname);
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${YEAR_SECONDS}; samesite=lax${domain ? `; domain=${domain}` : ''}`;
}
