import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ token: 'scp_live' as string | null, setEmbedToken: vi.fn(), dashboard: vi.fn() }));

vi.mock('@/lib/path-segment', () => ({ usePathSegment: () => h.token }));
vi.mock('@/lib/api', () => ({ setEmbedToken: h.setEmbedToken }));
// The dashboard itself is the embed's, tested there; here only what the portal hands it.
vi.mock('@/components/embed/EmbedDashboard', () => ({
  EmbedDashboard: (props: { id: string; token: string; clientMode: boolean }) => {
    h.dashboard(props);
    return <div data-testid="embed-dashboard" />;
  },
}));

import ClientPortalPage from '@/app/client-portal/[token]/page-client';
import { metadata } from '@/app/client-portal/[token]/page';
import { hexToHslTriple } from '@/features/agency/portal';

const session = (brand: Record<string, unknown> = {}) => ({
  data: {
    client: { id: 'c1', name: 'Northwind Coffee', company: '', status: 'active', features_enabled: {} },
    websites: [{ id: 'w1', name: 'Shop', url: 'shop.test' }],
    sections: ['analytics'],
    brand: {
      brand_name: 'Meridian Digital', logo_url: 'https://cdn.meridian.test/logo.png', primary_color: '#7c3aed',
      support_email: 'help@meridian.test', footer_text: 'Reports by Meridian', hide_seentics: true, ...brand,
    },
    client_user: { name: 'Maya', email: 'maya@northwind.test' },
    expires_at: '2026-11-16T00:00:00Z',
    embed_url: 'https://seentics.com/embed/c1?token=scp_live&client=1',
  },
});

const fetchMock = vi.fn();

beforeEach(() => {
  h.token = 'scp_live';
  h.setEmbedToken.mockReset();
  h.dashboard.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  document.documentElement.style.removeProperty('--primary');
});
afterEach(() => vi.unstubAllGlobals());

describe('client portal', () => {
  it('never passes its token on as a Referer, and is not indexed', () => {
    expect(metadata.referrer).toBe('no-referrer');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    // None of the root layout's Seentics share cards.
    expect(metadata.openGraph).toBeNull();
  });

  it('validates the token, then shows the client\'s data read-only through the embed API, branded', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(session()), { status: 200 }));
    render(<ClientPortalPage />);
    expect(await screen.findByTestId('embed-dashboard')).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/agency\/portal\/validate$/);
    expect(JSON.parse(init.body)).toEqual({ token: 'scp_live' });
    expect(init.referrerPolicy).toBe('no-referrer');

    expect(h.setEmbedToken).toHaveBeenCalledWith('scp_live');
    expect(h.dashboard).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1', token: 'scp_live', clientMode: true }));

    expect(screen.getByTestId('portal-brand').textContent).toBe('Meridian Digital');
    expect(screen.getByText('Northwind Coffee')).toBeTruthy();
    expect(screen.getByTestId('portal-footer').textContent).toBe('Reports by Meridian');
    expect(screen.getByRole('link', { name: 'help@meridian.test' }).getAttribute('href')).toBe('mailto:help@meridian.test');
    expect(screen.queryByText('Powered by Seentics')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(hexToHslTriple('#7c3aed'));
    expect(document.title).toBe('Meridian Digital');
    // Nothing links into the dashboard, which needs a Seentics login.
    expect(document.querySelector('a[href^="/websites/"]')).toBeNull();
  });

  it('says "Powered by Seentics" unless the agency hides it, and falls back to the client\'s name', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(session({ hide_seentics: false, brand_name: '', logo_url: '' })), { status: 200 }));
    render(<ClientPortalPage />);
    expect(await screen.findByText('Powered by Seentics')).toBeTruthy();
    expect(screen.getByTestId('portal-brand').textContent).toBe('Northwind Coffee');
  });

  it('a refused token reads as invalid or expired, and nothing is read', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'x', code: 'invalid_portal_token' }), { status: 401 }));
    render(<ClientPortalPage />);
    expect((await screen.findByTestId('portal-invalid')).textContent).toMatch(/invalid or has expired/);
    expect(h.setEmbedToken).not.toHaveBeenCalled();
    expect(screen.queryByTestId('embed-dashboard')).toBeNull();
  });

  it('a path that is not a portal token (the custom domain\'s "invalid link" page) is refused without asking', async () => {
    h.token = 'invalid';
    render(<ClientPortalPage />);
    expect(await screen.findByTestId('portal-invalid')).toBeTruthy();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
