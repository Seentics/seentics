import type { User } from '@/types';
import { useAuth } from '@/stores/useAuthStore';
import { onCustomHost } from '@/lib/seentics-host';

/**
 * Whether the signed-in person is an agency's client user. The user stored at sign-in carries
 * `kind: 'client'` (`/signin/verify` stores it); the access token's `kind` claim is the fallback,
 * so a session refreshed elsewhere is still recognised.
 */

function tokenKind(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { kind?: unknown };
    return typeof payload.kind === 'string' ? payload.kind : null;
  } catch {
    return null;
  }
}

export function isClientSession(user: Pick<User, 'kind'> | null | undefined, accessToken?: string | null): boolean {
  return user?.kind === 'client' || tokenKind(accessToken) === 'client';
}

/** The same, read from the persisted session (for code outside React, such as the API client). */
export function isClientSessionNow(): { client: boolean; slug: string | null } {
  if (typeof window === 'undefined') return { client: false, slug: null };
  try {
    const state = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state as
      | { user?: User | null; access_token?: string | null }
      | undefined;
    return { client: isClientSession(state?.user, state?.access_token), slug: state?.user?.agency?.slug ?? null };
  } catch {
    return { client: false, slug: null };
  }
}

export function useIsClientSession(): boolean {
  return useAuth(s => isClientSession(s.user, s.access_token));
}

/** The agency a client asked a link from, so an expired link can send them back to its sign-in. */
const AGENCY_KEY = 'seentics.client-agency';

export function rememberClientAgency(slug: string): void {
  try {
    window.sessionStorage.setItem(AGENCY_KEY, slug);
  } catch {
    /* storage blocked: the invalid-link page links to the generic sign-in instead */
  }
}

export function rememberedClientAgency(): string | null {
  try {
    return window.sessionStorage.getItem(AGENCY_KEY);
  } catch {
    return null;
  }
}

/** The agency's client sign-in page: plain `/signin` on its own domain, which names the agency. */
export const clientSignInHref = (slug: string | null | undefined): string =>
  slug && !onCustomHost() ? `/signin?agency=${encodeURIComponent(slug)}` : '/signin';
