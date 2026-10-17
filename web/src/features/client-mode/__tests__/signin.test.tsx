import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * `/signin`: with `?agency=<slug>` an agency's client users ask for an email link on a page in
 * the agency's brand; anything else goes to the account sign-in in the auth app, as before.
 */

const redirect = vi.hoisted(() => ({ hardRedirect: vi.fn() }));
vi.mock('@/lib/hard-redirect', () => redirect);
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));

import SignInPage from '@/app/signin/page';
import { config } from '@/lib/config';

const BRAND = {
  slug: 'meridian', brand_name: 'Meridian Digital', logo_url: 'https://cdn.meridian.test/logo.png', primary_color: '#7c3aed',
  support_email: 'help@meridian.test', footer_text: 'Reports by Meridian', hide_seentics: true,
};

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let brandAnswer: { status: number; body?: unknown } = { status: 200, body: { data: BRAND } };

function visit(url: string) {
  window.history.replaceState({}, '', url);
}

beforeEach(() => {
  calls = [];
  brandAnswer = { status: 200, body: { data: BRAND } };
  window.sessionStorage.clear();
  redirect.hardRedirect.mockClear();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('/client-auth/brand')) {
      return new Response(brandAnswer.body ? JSON.stringify(brandAnswer.body) : '{"error":"not_found"}', { status: brandAnswer.status });
    }
    if (url.includes('/client-auth/magic-link')) return new Response('{"data":{"sent":true}}', { status: 202 });
    return new Response('{}', { status: 404 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  visit('/');
});

describe('client sign-in page', () => {
  it('shows the agency’s brand: name, logo and colour, and no Seentics marks when hidden', async () => {
    visit('/signin?agency=Meridian');
    render(<SignInPage />);
    expect(await screen.findByRole('heading', { name: 'Sign in to Meridian Digital' })).toBeTruthy();
    expect(calls[0]!.url).toContain('/client-auth/brand?agency=meridian');
    const shell = screen.getByTestId('client-auth-shell');
    expect(shell.style.getPropertyValue('--primary')).toBe('262 83% 58%');
    expect(screen.getByTestId('client-auth-brand').querySelector('img')?.getAttribute('src')).toBe(BRAND.logo_url);
    expect(screen.getByText('Reports by Meridian')).toBeTruthy();
    expect(screen.queryByText(/Seentics/)).toBeNull();
    expect(redirect.hardRedirect).not.toHaveBeenCalled();
  });

  it('says "Powered by Seentics" when the agency does not hide it', async () => {
    brandAnswer = { status: 200, body: { data: { ...BRAND, hide_seentics: false, logo_url: '' } } };
    visit('/signin?agency=meridian');
    render(<SignInPage />);
    expect(await screen.findByTestId('powered-by-seentics')).toBeTruthy();
    // No logo: the brand's initial.
    expect(screen.getByTestId('client-auth-brand')).toHaveTextContent('MMeridian Digital');
  });

  it('asks for a link and shows "Check your email" without saying whether the address is a member', async () => {
    visit('/signin?agency=meridian');
    render(<SignInPage />);
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: ' jess@acme.test ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeTruthy();
    const sent = calls.find(c => c.url.includes('/client-auth/magic-link'))!;
    expect(sent.init?.method).toBe('POST');
    expect(JSON.parse(sent.init!.body as string)).toEqual({ email: 'jess@acme.test', agency: 'meridian' });
    expect(screen.getByTestId('client-signin-sent')).toHaveTextContent('expires in 15 minutes');
    expect(screen.getByText(/If/).textContent).toContain('can sign in to Meridian Digital');
    // Remembered for /signin/verify, so an expired link leads back here.
    expect(window.sessionStorage.getItem('seentics.client-agency')).toBe('meridian');
  });

  it('checks the address before sending', async () => {
    visit('/signin?agency=meridian');
    render(<SignInPage />);
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(calls.some(c => c.url.includes('/magic-link'))).toBe(false);
  });

  it('explains an ended session', async () => {
    visit('/signin?agency=meridian&expired=true');
    render(<SignInPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has ended');
  });

  it('without ?agency, goes to the account sign-in as before, keeping the query', async () => {
    visit('/signin?expired=true');
    render(<SignInPage />);
    await waitFor(() => expect(redirect.hardRedirect).toHaveBeenCalledWith(`${config.authUrl}/signin?expired=true`));
    expect(calls).toHaveLength(0);
  });

  it('with an agency that does not exist, goes to the account sign-in', async () => {
    brandAnswer = { status: 404 };
    visit('/signin?agency=nobody');
    render(<SignInPage />);
    await waitFor(() => expect(redirect.hardRedirect).toHaveBeenCalledWith(`${config.authUrl}/signin`));
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
