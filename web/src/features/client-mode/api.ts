import api from '@/lib/api';
import { getApiUrl } from '@/lib/config';
import type { User } from '@/types';
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

export class ClientAuthError extends Error {
  constructor(public code: 'invalid_link' | 'rate_limited' | 'unavailable', message: string) {
    super(message);
  }
}

/** Asks for a sign-in link. The gateway answers 202 whether or not the email is a member. */
export async function requestMagicLink(email: string, agency: string): Promise<void> {
  let res: Response;
  try {
    res = await send('/client-auth/magic-link', { method: 'POST', body: JSON.stringify({ email, agency }) });
  } catch {
    throw new ClientAuthError('unavailable', 'We could not reach the server. Check your connection and try again.');
  }
  if (res.status === 429) throw new ClientAuthError('rate_limited', 'Too many sign-in links were asked for. Please wait a while and try again.');
  if (!res.ok) throw new ClientAuthError('unavailable', 'We could not send a link just now. Please try again in a moment.');
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
    throw new ClientAuthError('unavailable', 'We could not reach the server. Check your connection and try again.');
  }
  if (res.status === 429) throw new ClientAuthError('rate_limited', 'Too many attempts. Please wait a minute and try again.');
  if (res.status >= 500) throw new ClientAuthError('unavailable', 'Signing in is unavailable just now. Please try again in a moment.');
  const body = (await res.json().catch(() => ({}))) as VerifyBody;
  const data = body.data;
  const access = data?.tokens?.access_token ?? data?.access_token;
  const refresh = data?.tokens?.refresh_token ?? data?.refresh_token ?? '';
  if (!res.ok || !data?.user || !access) throw new ClientAuthError('invalid_link', 'This link is invalid or has expired.');
  const agency = data.agency ?? data.user.agency ?? { owner_id: '', slug: null };
  return { user: { ...data.user, kind: 'client', agency }, access_token: access, refresh_token: refresh, agency };
}

/** The agency's brand for its sign-in page; `null` when there is no agency by that name. */
export async function getClientBrand(slug: string): Promise<ClientBrand | null> {
  const res = await send(`/client-auth/brand?agency=${encodeURIComponent(slug)}`, { method: 'GET' });
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
