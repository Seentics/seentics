import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * On an agency's own domain (reports.meridian.test): the API is the same-origin `/api/v1` proxy,
 * the sign-in needs no `?agency=` (the domain names the agency), the link's session is stored
 * from the body, and signing out (or a session ending) comes back to `/signin` on the same host.
 */

const redirect = vi.hoisted(() => ({ hardRedirect: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/hard-redirect', () => redirect);
vi.mock('next/navigation', () => ({ useRouter: () => nav, usePathname: () => '/signin' }));
vi.mock('@/features/client-mode/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/client-mode/api')>()),
  getClientMe: vi.fn(async () => { throw new Error('offline'); }),
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));

import SignInPage from '@/app/signin/page';
import VerifyClientLinkPage from '@/app/signin/verify/page';
import { getApiUrl } from '@/lib/config';
import { performLogout } from '@/lib/api';
import { isClientAudience } from '@/lib/sessionless';
import { clientSignInHref } from '@/features/client-mode/session';
import { useAuth } from '@/stores/useAuthStore';

const BRAND = {
  slug: 'meridian', brand_name: 'Meridian Digital', logo_url: '', primary_color: '#7c3aed',
  support_email: '', footer_text: '', hide_seentics: true, custom_domain: 'reports.meridian.test',
};

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let brandStatus = 200;

/** jsdom's location can't be moved to another host; a stand-in with the parts the code reads. */
function onHost(host: string, path = '/', hash = '') {
  const url = new URL(`https://${host}${path}`);
  vi.stubGlobal('location', { hostname: url.hostname, host: url.host, origin: url.origin, pathname: url.pathname, search: url.search, hash, href: url.href });
}

beforeEach(() => {
  calls = [];
  brandStatus = 200;
  nav.replace.mockClear();
  redirect.hardRedirect.mockClear();
  window.sessionStorage.clear();
  useAuth.getState().resetAuth();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('/client-auth/brand')) return new Response(brandStatus === 200 ? JSON.stringify({ data: BRAND }) : '{}', { status: brandStatus });
    if (url.includes('/client-auth/magic-link')) return new Response('{"data":{"sent":true}}', { status: 202 });
    if (url.includes('/client-auth/verify')) {
      return new Response(JSON.stringify({
        data: { user: { id: 'u1', email: 'jess@acme.test', name: 'Jess', kind: 'client' }, tokens: { access_token: 'acc.jwt', refresh_token: 'ref.jwt' }, agency: { owner_id: 'o1', slug: 'meridian' } },
      }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('on an agency’s own domain', () => {
  it('calls the API through the same-origin proxy', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.seentics.com');
    onHost('reports.meridian.test');
    expect(getApiUrl('/client/me')).toBe('/api/v1/client/me');
    expect(getApiUrl()).toBe('/api/v1');
    onHost('seentics.com');
    expect(getApiUrl('/client/me')).toBe('https://api.seentics.com/api/v1/client/me');
    vi.unstubAllEnvs();
  });

  it('signs in without ?agency: the brand and the link are asked for the domain', async () => {
    onHost('reports.meridian.test', '/signin');
    render(<SignInPage />);
    expect(await screen.findByRole('heading', { name: 'Sign in to Meridian Digital' })).toBeTruthy();
    expect(calls[0]!.url).toBe('/api/v1/client-auth/brand');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jess@acme.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(await screen.findByTestId('client-signin-sent')).toBeTruthy();
    const sent = calls.find(c => c.url.includes('/client-auth/magic-link'))!;
    expect(sent.url).toBe('/api/v1/client-auth/magic-link');
    expect(JSON.parse(sent.init!.body as string)).toEqual({ email: 'jess@acme.test' });
    expect(redirect.hardRedirect).not.toHaveBeenCalled();
    expect(screen.queryByText(/Seentics/)).toBeNull();
  });

  it('never sends a visitor to the account sign-in, even without a brand', async () => {
    brandStatus = 404;
    onHost('reports.meridian.test', '/signin');
    render(<SignInPage />);
    expect(await screen.findByRole('heading', { name: 'Sign in to your dashboard' })).toBeTruthy();
    expect(redirect.hardRedirect).not.toHaveBeenCalled();
    // No Seentics mark on the agency's domain.
    expect(screen.queryByText('Seentics')).toBeNull();
  });

  it('stores the session from the verify body and asks the brand for the domain', async () => {
    onHost('reports.meridian.test', '/signin/verify', '#t=tok_1');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><VerifyClientLinkPage /></QueryClientProvider>);
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    expect(useAuth.getState().access_token).toBe('acc.jwt');
    expect(useAuth.getState().refresh_token).toBe('ref.jwt');
    expect(calls.some(c => c.url === '/api/v1/client-auth/verify')).toBe(true);
    expect(calls.some(c => c.url === '/api/v1/client-auth/brand')).toBe(true);
  });

  it('signs out to /signin on the same host', () => {
    onHost('reports.meridian.test', '/websites/w1');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { kind: 'client', agency: { slug: 'meridian' } }, isAuthenticated: true } }));
    performLogout();
    expect(window.location.href).toBe('/signin?expired=true');
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(clientSignInHref('meridian')).toBe('/signin');
  });

  it('keeps ?agency= on seentics.com', () => {
    onHost('seentics.com', '/websites/w1');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { kind: 'client', agency: { slug: 'meridian' } }, isAuthenticated: true } }));
    performLogout();
    expect(window.location.href).toBe('/signin?agency=meridian&expired=true');
    expect(clientSignInHref('meridian')).toBe('/signin?agency=meridian');
  });

  it('is the agency’s audience everywhere: no chat, no self-tracking', () => {
    onHost('reports.meridian.test');
    expect(isClientAudience('/websites/w1', null)).toBe(true);
    onHost('seentics.com');
    expect(isClientAudience('/websites/w1', null)).toBe(false);
  });
});
