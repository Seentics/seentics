import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/agency/branding' }));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [] }));

import { DOMAIN_POLL_MS } from '@/features/agency/constants';
import { isDomainPending } from '@/features/agency/queries';
import { HttpError, renderWithClient, resetApi, route, sentTo } from './harness';
import { BrandingView, brandingProblems } from '../BrandingView';

const BRANDING = {
  brand_name: 'Meridian', logo_url: '', primary_color: '#7c3aed', support_email: 'help@meridian.test',
  footer_text: 'Reports by Meridian', hide_seentics: false, slug: null as string | null, updated_at: null,
};

const domain = (over: Record<string, unknown> = {}) => ({
  hostname: 'reports.meridian.test', state: 'pending_dns', reason: null, cname_target: 'portal.seentics.com',
  ownership_verification: { name: '_cf.reports.meridian.test', type: 'txt', value: 'verify-me' },
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', last_checked_at: null, ...over,
});

beforeEach(() => {
  resetApi();
  route('GET', '/agency/branding', { data: BRANDING });
  route('GET', '/agency/domain', { data: null });
});

describe('white label', () => {
  it('loads, previews and saves every field', async () => {
    route('PUT', '/agency/branding', req => ({ data: { ...BRANDING, ...(req.data as object) } }));
    renderWithClient(<BrandingView />);
    const footer = await screen.findByLabelText('Footer text');
    await waitFor(() => expect((footer as HTMLInputElement).value).toBe('Reports by Meridian'));
    const preview = screen.getByTestId('brand-preview');
    expect(preview).toHaveTextContent('Meridian');
    expect(preview).toHaveTextContent('Powered by Seentics');

    fireEvent.change(screen.getByLabelText('Brand name'), { target: { value: 'Meridian Digital' } });
    fireEvent.change(screen.getByLabelText('Sign-in name'), { target: { value: 'Meridian' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Hide Seentics branding' }));
    expect(preview).toHaveTextContent('Meridian Digital');
    expect(preview).not.toHaveTextContent('Powered by Seentics');
    expect(preview).toHaveTextContent('agency=meridian');

    fireEvent.click(screen.getByRole('button', { name: 'Save branding' }));
    await waitFor(() => expect(sentTo('PUT', '/agency/branding')).toHaveLength(1));
    expect(sentTo('PUT', '/agency/branding')[0]!.data).toEqual({
      brand_name: 'Meridian Digital', logo_url: '', primary_color: '#7c3aed', support_email: 'help@meridian.test',
      footer_text: 'Reports by Meridian', hide_seentics: true, slug: 'meridian',
    });
  });

  it('refuses a logo that is not https before asking', async () => {
    renderWithClient(<BrandingView />);
    fireEvent.change(await screen.findByLabelText('Logo URL'), { target: { value: 'http://cdn.test/logo.png' } });
    expect(screen.getByText('The logo must be an https:// address.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save branding' })).toBeDisabled();
  });

  it('shows a taken slug from the server', async () => {
    route('PUT', '/agency/branding', () => new HttpError(409, 'conflict', 'That slug is taken by another agency.'));
    renderWithClient(<BrandingView />);
    await screen.findByLabelText('Brand name');
    fireEvent.click(screen.getByRole('button', { name: 'Save branding' }));
    expect(await screen.findByText('That slug is taken by another agency.')).toBeTruthy();
  });

  it('validates fields', () => {
    expect(brandingProblems({ ...BRANDING, slug: 'ok-slug' })).toEqual({});
    expect(Object.keys(brandingProblems({ ...BRANDING, primary_color: 'purple', support_email: 'x', slug: 'A!' }))).toEqual(
      ['primary_color', 'support_email', 'slug'],
    );
  });
});

describe('custom domain', () => {
  it('adds a domain and shows the DNS records while pending', async () => {
    route('PUT', '/agency/domain', req => ({ data: domain({ hostname: (req.data as { hostname: string }).hostname }) }));
    renderWithClient(<BrandingView />);
    fireEvent.change(await screen.findByLabelText('Hostname'), { target: { value: 'https://Reports.Meridian.test/x' } });
    route('GET', '/agency/domain', { data: domain() });
    fireEvent.click(screen.getByRole('button', { name: /Add domain/ }));
    expect(await screen.findByTestId('domain-state')).toHaveTextContent('Waiting for DNS');
    expect(sentTo('PUT', '/agency/domain')[0]!.data).toEqual({ hostname: 'reports.meridian.test' });
    expect(screen.getByTestId('dns-cname')).toHaveTextContent('portal.seentics.com');
    expect(screen.getByTestId('dns-txt')).toHaveTextContent('verify-me');
  });

  it('polls only while pending', () => {
    expect(DOMAIN_POLL_MS).toBe(15_000);
    expect(isDomainPending(domain() as never)).toBe(true);
    expect(isDomainPending(domain({ state: 'pending_certificate' }) as never)).toBe(true);
    expect(isDomainPending(domain({ state: 'active' }) as never)).toBe(false);
    expect(isDomainPending(null)).toBe(false);
  });

  it('checks again on demand', async () => {
    route('GET', '/agency/domain', { data: domain() });
    route('POST', '/agency/domain/refresh', () => {
      route('GET', '/agency/domain', { data: domain({ state: 'active' }) });
      return { data: domain({ state: 'active' }) };
    });
    renderWithClient(<BrandingView />);
    fireEvent.click(await screen.findByRole('button', { name: /Check now/ }));
    await waitFor(() => expect(screen.getByTestId('domain-state')).toHaveTextContent('Active'));
    expect(screen.queryByTestId('dns-cname')).toBeNull();
    expect(screen.getByTestId('brand-preview')).toHaveTextContent('https://reports.meridian.test');
  });

  it('shows the client dashboard address once the domain is active', async () => {
    route('GET', '/agency/domain', { data: domain({ state: 'active', ownership_verification: null, dashboard_url: 'https://reports.meridian.test' }) });
    renderWithClient(<BrandingView />);
    const line = await screen.findByTestId('client-dashboard-url');
    expect(line).toHaveTextContent('Client dashboard: https://reports.meridian.test');
    expect(within(line).getByRole('link')).toHaveAttribute('href', 'https://reports.meridian.test');
  });

  it('shows no dashboard address while the domain is pending', async () => {
    route('GET', '/agency/domain', { data: domain() });
    renderWithClient(<BrandingView />);
    await screen.findByTestId('domain-state');
    expect(screen.queryByTestId('client-dashboard-url')).toBeNull();
  });

  it('shows why a domain failed', async () => {
    route('GET', '/agency/domain', { data: domain({ state: 'failed', reason: 'The CNAME points somewhere else.' }) });
    renderWithClient(<BrandingView />);
    expect(await screen.findByText('The CNAME points somewhere else.')).toBeTruthy();
    expect(screen.getByTestId('domain-state')).toHaveTextContent('Failed');
  });

  it('removes the domain after confirming', async () => {
    route('GET', '/agency/domain', { data: domain({ state: 'active' }) });
    route('DELETE', '/agency/domain', () => { route('GET', '/agency/domain', { data: null }); return ''; });
    renderWithClient(<BrandingView />);
    fireEvent.click(await screen.findByRole('button', { name: /Remove/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove domain' }));
    expect(await screen.findByLabelText('Hostname')).toBeTruthy();
    expect(sentTo('DELETE', '/agency/domain')).toHaveLength(1);
  });

  it('explains a taken hostname and an invalid one', async () => {
    route('PUT', '/agency/domain', () => new HttpError(409, 'conflict', 'Another account already uses this hostname.'));
    renderWithClient(<BrandingView />);
    const input = await screen.findByLabelText('Hostname');
    fireEvent.change(input, { target: { value: 'taken.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Add domain/ }));
    expect(await screen.findByText('That hostname is already in use by another account.')).toBeTruthy();

    route('PUT', '/agency/domain', () => new HttpError(422, 'validation_failed', 'Use a subdomain, not an apex domain.'));
    fireEvent.change(input, { target: { value: 'meridian.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Add domain/ }));
    expect(await screen.findByText('Use a subdomain, not an apex domain.')).toBeTruthy();
  });

  it('shows at once that custom domains are unavailable when the server has none (503)', async () => {
    route('GET', '/agency/domain', () => new HttpError(503, 'provider_error', 'Custom domains are not available on this server.'));
    renderWithClient(<BrandingView />);
    const section = await screen.findByTestId('domain-section');
    expect(await within(section).findByTestId('domains-unavailable')).toHaveTextContent('Custom domains aren’t available yet');
    expect(within(section).queryByLabelText('Hostname')).toBeNull();
    expect(within(section).queryByRole('button', { name: /Add domain/ })).toBeNull();
    // The white-label form still works.
    expect(screen.getByRole('button', { name: 'Save branding' })).toBeTruthy();
  });

  it('says so when a save meets the 503 too', async () => {
    route('PUT', '/agency/domain', () => new HttpError(503, 'provider_error', 'Custom domains are not available on this server.'));
    renderWithClient(<BrandingView />);
    fireEvent.change(await screen.findByLabelText('Hostname'), { target: { value: 'reports.meridian.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Add domain/ }));
    expect(await screen.findByText('Custom domains are unavailable right now. Please try again later.')).toBeTruthy();
  });
});
