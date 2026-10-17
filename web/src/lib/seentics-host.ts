import { useSyncExternalStore } from 'react';

/**
 * Seentics' own hosts, as opposed to an agency's domain serving its client dashboard
 * (docs/agency-workspace.md "White-label domain serving the full dashboard"). Mirrors
 * functions/lib/custom-host.ts `isSeenticsHost`, which decides the same at the edge.
 */
export function isSeenticsHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '');
  return (
    h === 'seentics.com' ||
    h.endsWith('.seentics.com') ||
    h.endsWith('.pages.dev') ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]'
  );
}

/**
 * Whether this page is open on an agency's own domain. There, the API is the same-origin
 * `/api/v1` proxy, sessions are client users' bearer tokens, sign-in needs no `?agency=`, and
 * nothing of Seentics' own (marketing and docs links, chat, our tracker) is shown or loaded.
 */
export function onCustomHost(): boolean {
  return typeof window !== 'undefined' && !isSeenticsHostname(window.location.hostname);
}

const noSubscribe = () => () => undefined;

/** `onCustomHost()` for rendering: `false` in the static HTML, the real answer once hydrated. */
export function useOnCustomHost(): boolean {
  return useSyncExternalStore(noSubscribe, onCustomHost, () => false);
}
