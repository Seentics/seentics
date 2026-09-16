/**
 * `redirect_uri` round-trips a user back to whichever product/page they came
 * from before hitting a login wall (e.g. `uptime.seentics.com` redirecting
 * here, then back after signin). It's attacker-controlled query-string input,
 * so it's validated against the suite's own domain before ever being used —
 * otherwise this is a textbook open redirect (phishing via a trusted login
 * page that bounces to an attacker's site).
 */

const ALLOWED_SUFFIXES = ['.seentics.com'];
const ALLOWED_HOSTS = ['seentics.com', 'localhost', '127.0.0.1'];

export function isSafeRedirectUri(candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.includes(host) || ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Returns the validated `redirect_uri` from a URLSearchParams, or `fallback` if absent/unsafe. */
export function getSafeRedirectUri(searchParams: URLSearchParams, fallback: string): string {
  const candidate = searchParams.get('redirect_uri');
  if (!candidate) return fallback;
  return isSafeRedirectUri(candidate) ? candidate : fallback;
}
