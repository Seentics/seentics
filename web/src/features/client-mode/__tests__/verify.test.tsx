import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * `/signin/verify#t=<token>`: the email link. A good token becomes a session stored as an
 * account's is, and the client lands on their first website; a used or expired one says so and
 * links back to the agency's sign-in.
 */

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const me = vi.hoisted(() => ({ getClientMe: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/signin/verify' }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ default: { get: async (url: string) => ({ data: { data: await me.getClientMe(url) } }) }, setApiToken: vi.fn() }));

import VerifyClientLinkPage from '@/app/signin/verify/page';
import { useAuth } from '@/stores/useAuthStore';

const USER = { id: 'u1', email: 'jess@acme.test', name: 'Jess', role: 'user', kind: 'client' };
const AGENCY = { owner_id: 'owner-1', slug: 'meridian' };
const ME = {
  user: { id: 'u1', email: 'jess@acme.test', name: 'Jess' },
  agency: AGENCY,
  brand: null,
  websites: [
    { id: 'w1', name: 'Acme', url: 'https://acme.test', client_id: 'c1', client_name: 'Acme', features: { overview: 'off', funnels: 'view' } },
  ],
};

let verifyAnswer: { status: number; body: unknown };
let posted: unknown[] = [];

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><VerifyClientLinkPage /></QueryClientProvider>);
};

beforeEach(() => {
  posted = [];
  nav.replace.mockClear();
  me.getClientMe.mockReset().mockResolvedValue(ME);
  useAuth.getState().resetAuth();
  window.sessionStorage.clear();
  localStorage.setItem('seentics:last-website', 'account-site');
  verifyAnswer = {
    status: 200,
    body: { message: 'Logged in successfully', data: { user: USER, tokens: { access_token: 'acc.jwt', refresh_token: 'ref.jwt' }, agency: AGENCY } },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/client-auth/verify')) {
      posted.push(JSON.parse(init!.body as string));
      return new Response(JSON.stringify(verifyAnswer.body), { status: verifyAnswer.status });
    }
    if (url.includes('/client-auth/brand')) return new Response('{"error":"not_found"}', { status: 404 });
    return new Response('{}', { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
  localStorage.clear();
});

describe('client link verify page', () => {
  it('trades the token for a session stored like an account’s, then opens the first page the client may see', async () => {
    window.history.replaceState({}, '', '/signin/verify#t=tok_123');
    renderPage();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/websites/w1/funnels'));
    expect(posted).toEqual([{ token: 'tok_123' }]);
    const state = useAuth.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.access_token).toBe('acc.jwt');
    expect(state.refresh_token).toBe('ref.jwt');
    expect(state.user).toMatchObject({ id: 'u1', kind: 'client', agency: AGENCY });
    // Persisted where the API client reads its bearer token.
    expect(JSON.parse(localStorage.getItem('auth-storage')!).state).toMatchObject({ access_token: 'acc.jwt', isAuthenticated: true });
    // The token is taken off the address; the account's last site is forgotten.
    expect(window.location.hash).toBe('');
    expect(localStorage.getItem('seentics:last-website')).toBeNull();
    expect(window.sessionStorage.getItem('seentics.client-agency')).toBe('meridian');
  });

  it('lands on /websites when the client’s websites cannot be read', async () => {
    me.getClientMe.mockRejectedValue(new Error('down'));
    window.history.replaceState({}, '', '/signin/verify#t=tok_123');
    renderPage();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/websites'));
  });

  it('says a used or expired link is invalid and links back to the agency’s sign-in', async () => {
    window.sessionStorage.setItem('seentics.client-agency', 'meridian');
    verifyAnswer = { status: 401, body: { error: 'invalid_link' } };
    window.history.replaceState({}, '', '/signin/verify#t=used');
    renderPage();
    expect(await screen.findByRole('heading', { name: 'This link is invalid or has expired' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/signin?agency=meridian');
    expect(useAuth.getState().isAuthenticated).toBe(false);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('treats a link without a token as invalid, without asking the server', async () => {
    window.history.replaceState({}, '', '/signin/verify');
    renderPage();
    expect(await screen.findByTestId('client-link-invalid')).toBeTruthy();
    expect(posted).toHaveLength(0);
  });
});
