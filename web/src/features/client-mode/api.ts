import api from '@/lib/api';
import { getApiUrl } from '@/lib/config';
import type { User } from '@/types';
import { agencyEn, type AgencyMessages } from '@/lib/i18n/messages/agency-en';
import type { ClientBrand, ClientMe } from './types';

/**
 * Client sign-in (`/client-auth/*`) is asked with a plain fetch, not the API client: that one
 * tries a token refresh on any 401 when an old session sits in this browser, and a refused link
 * must not sign anyone out or redirect. `/client/me` needs the session, so it uses the client.
 */

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(getApiUrl(path), {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

/** Which failure, as a key of `useT().agency.clientAuthErrors`, for the page to show in the visitor's language. */
export type ClientAuthErrorReason = keyof AgencyMessages['clientAuthErrors'];

/** A client sign-in failure. `message` is English; pages show `useT().agency.clientAuthErrors[reason]`. */
export class ClientAuthError extends Error {
  constructor(public code: 'invalid_link' | 'rate_limited' | 'unavailable', public reason: ClientAuthErrorReason) {
    super(agencyEn.clientAuthErrors[reason]);
  }
}

/**
 * Asks for a sign-in link. The gateway answers 202 whether or not the email is a member. On an
 * agency's own domain `agency` is left out: the domain names the agency.
 */
export async function requestMagicLink(email: string, agency?: string | null): Promise<void> {
  let res: Response;
  try {
    const body = agency ? { email, agency } : { email };
    res = await send('/client-auth/magic-link', { method: 'POST', body: JSON.stringify(body) });
  } catch {
    throw new ClientAuthError('unavailable', 'unreachable');
  }
  if (res.status === 429) throw new ClientAuthError('rate_limited', 'tooManyLinks');
  if (!res.ok) throw new ClientAuthError('unavailable', 'sendFailed');
}

export interface VerifiedSession {
  user: User;
  access_token: string;
  refresh_token: string;
  agency: { owner_id: string; slug: string | null };
}

type VerifyBody = {
  data?: {
    user?: User;
    tokens?: { access_token?: string; refresh_token?: string };
    access_token?: string;
    refresh_token?: string;
    agency?: { owner_id: string; slug: string | null };
  };
};

/**
 * Trades the link's token for a session: the account login's `{ data: { user, tokens } }`, with
 * `user.kind = 'client'` and the agency. 401 `invalid_link` when used, expired or revoked.
 */
export async function verifyMagicLink(token: string): Promise<VerifiedSession> {
  let res: Response;
  try {
    res = await send('/client-auth/verify', { method: 'POST', body: JSON.stringify({ token }) });
  } catch {
    throw new ClientAuthError('unavailable', 'unreachable');
  }
  if (res.status === 429) throw new ClientAuthError('rate_limited', 'tooManyAttempts');
  if (res.status >= 500) throw new ClientAuthError('unavailable', 'signinUnavailable');
  const body = (await res.json().catch(() => ({}))) as VerifyBody;
  const data = body.data;
  const access = data?.tokens?.access_token ?? data?.access_token;
  const refresh = data?.tokens?.refresh_token ?? data?.refresh_token ?? '';
  if (!res.ok || !data?.user || !access) throw new ClientAuthError('invalid_link', 'invalidLink');
  const agency = data.agency ?? data.user.agency ?? { owner_id: '', slug: null };
  return { user: { ...data.user, kind: 'client', agency }, access_token: access, refresh_token: refresh, agency };
}

/**
 * The agency's brand for its sign-in page; `null` when there is no agency by that name. Without a
 * slug (on an agency's own domain) the gateway answers for the agency owning the domain.
 */
export async function getClientBrand(slug?: string | null): Promise<ClientBrand | null> {
  const query = slug ? `?agency=${encodeURIComponent(slug)}` : '';
  const res = await send(`/client-auth/brand${query}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`brand ${res.status}`);
  const body = (await res.json()) as { data?: ClientBrand };
  return body.data ?? null;
}

/** The client user, their agency's brand and the websites they may open, with each one's features. */
export async function getClientMe(): Promise<ClientMe> {
  const res = await api.get<{ data: ClientMe }>('/client/me');
  return res.data.data;
}
