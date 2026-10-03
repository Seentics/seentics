/**
 * The website the dashboard last opened, so /websites can go straight to it.
 *
 * /websites used to wait for the session check and the websites list before redirecting —
 * two round trips before the dashboard even started loading. Remembered, it redirects at
 * once; the dashboard confirms the site is still in the list and forgets it if not.
 */
const KEY = 'seentics:last-website';

export function rememberedWebsite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberWebsite(websiteId: string): void {
  try {
    localStorage.setItem(KEY, websiteId);
  } catch {
    // Storage unavailable: /websites takes the slow path, nothing breaks.
  }
}

export function forgetWebsite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
