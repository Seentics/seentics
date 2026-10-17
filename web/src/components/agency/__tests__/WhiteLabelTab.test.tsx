import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CustomDomain, WhiteLabelSettings } from '@/features/agency/types';

/** Cloud, on the Agency plan, on a real website: the real queries, over a mocked API. */
const h = vi.hoisted(() => ({
  settings: null as WhiteLabelSettings | null,
  domain: null as CustomDomain | null,
  update: vi.fn(),
  setDomain: vi.fn(),
  refresh: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/lib/features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/features')>()),
  isEnterprise: true,
}));
vi.mock('@/features/suite/queries', () => ({
  useEntitlements: () => ({ data: { products: { core: { plan: 'Agency', tier: 'agency', limits: { agency_features: 1 } } } } }),
}));
vi.mock('@/features/agency/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/agency/api')>()),
  getWhiteLabel: async () => h.settings,
  getCustomDomain: async () => h.domain,
  updateWhiteLabel: h.update,
  setCustomDomain: h.setDomain,
  refreshCustomDomain: h.refresh,
  removeCustomDomain: h.remove,
}));

import { WhiteLabelTab } from '@/components/agency/tabs/WhiteLabelTab';
import { CUSTOM_DOMAIN_POLL_MS, isDomainPending } from '@/features/agency/queries';

const SETTINGS: WhiteLabelSettings = {
  brandName: 'Meridian', logoUrl: '', primaryColor: '#7c3aed', supportEmail: 'help@meridian.test',
  footerText: 'Reports by Meridian', hideSeentics: false, updatedAt: null,
};
const domain = (over: Partial<CustomDomain>): CustomDomain => ({
  hostname: 'reports.meridian.test', state: 'pending_dns', reason: null, cnameTarget: 'portal.seentics.com',
  ownershipVerification: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', lastCheckedAt: null, ...over,
});

const setup = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <WhiteLabelTab websiteId="w1" />
  </QueryClientProvider>,
);

beforeEach(() => {
  h.settings = { ...SETTINGS };
  h.domain = null;
  for (const f of [h.update, h.setDomain, h.refresh, h.remove]) f.mockReset();
});

describe('white label form', () => {
  it('loads the settings and saves every field, footer included', async () => {
    h.update.mockImplementation(async (patch: Partial<WhiteLabelSettings>) => ({ ...SETTINGS, ...patch }));
    setup();
    const footer = await screen.findByLabelText('Footer text');
    expect((footer as HTMLInputElement).value).toBe('Reports by Meridian');
    fireEvent.change(footer, { target: { value: 'Made by Meridian' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Hide Seentics branding' }));
    fireEvent.click(screen.getByRole('button', { name: /Save settings/ }));
    await waitFor(() => expect(h.update).toHaveBeenCalled());
    expect(h.update.mock.calls[0]![0]).toEqual({
      brandName: 'Meridian', logoUrl: '', primaryColor: '#7c3aed', supportEmail: 'help@meridian.test',
      footerText: 'Made by Meridian', hideSeentics: true,
    });
  });

  it('refuses a logo that is not https before asking', async () => {
    setup();
    fireEvent.change(await screen.findByLabelText('Logo URL'), { target: { value: 'http://cdn.test/logo.png' } });
    expect(screen.getByText('The logo must be an https:// address.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Save settings/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('previews the brand, and drops "Powered by Seentics" when hidden', async () => {
    setup();
    expect(await screen.findByText('Powered by Seentics')).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Hide Seentics branding' }));
    expect(screen.queryByText('Powered by Seentics')).toBeNull();
  });
});

describe('custom domain', () => {
  it('suggests a subdomain, and claims the hostname typed', async () => {
    h.setDomain.mockResolvedValue(domain({}));
    setup();
    const input = await screen.findByLabelText('Hostname');
    expect(input.getAttribute('placeholder')).toBe('reports.youragency.com');
    fireEvent.change(input, { target: { value: 'https://Reports.Meridian.test/' } });
    fireEvent.click(screen.getByRole('button', { name: /Add domain/ }));
    await waitFor(() => expect(h.setDomain).toHaveBeenCalled());
    expect(h.setDomain.mock.calls[0]![0]).toBe('reports.meridian.test');
    expect(await screen.findByText('Waiting for DNS')).toBeTruthy();
  });

  it('pending DNS: shows the CNAME, and the TXT ownership record when there is one', async () => {
    h.domain = domain({ ownershipVerification: { name: '_cf-custom-hostname.reports.meridian.test', type: 'txt', value: 'abc-123' } });
    setup();
    expect(await screen.findByText('Waiting for DNS')).toBeTruthy();
    const cname = screen.getByTestId('dns-cname');
    expect(cname.textContent).toContain('reports.meridian.test');
    expect(cname.textContent).toContain('portal.seentics.com');
    const txt = screen.getByTestId('dns-txt');
    expect(txt.textContent).toContain('_cf-custom-hostname.reports.meridian.test');
    expect(txt.textContent).toContain('abc-123');
  });

  it('active: no records to add, and nothing to check', async () => {
    h.domain = domain({ state: 'active' });
    setup();
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.queryByTestId('dns-cname')).toBeNull();
    expect(screen.queryByRole('button', { name: /Check now/ })).toBeNull();
  });

  it('failed: says why, and Check now refreshes', async () => {
    h.domain = domain({ state: 'failed', reason: 'The CNAME points somewhere else.' });
    h.refresh.mockResolvedValue(domain({ state: 'pending_certificate' }));
    setup();
    expect(await screen.findByText('The CNAME points somewhere else.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Check now/ }));
    expect(await screen.findByText('Issuing certificate')).toBeTruthy();
  });

  it('shows the gateway\'s refusal in words', async () => {
    h.setDomain.mockRejectedValue({ response: { status: 409, data: { error: 'hostname_taken' } } });
    setup();
    fireEvent.change(await screen.findByLabelText('Hostname'), { target: { value: 'reports.taken.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Add domain/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already in use/);
  });

  it('polls only while the domain is being set up', () => {
    expect(CUSTOM_DOMAIN_POLL_MS).toBeGreaterThan(0);
    expect(isDomainPending(domain({ state: 'pending_dns' }))).toBe(true);
    expect(isDomainPending(domain({ state: 'pending_certificate' }))).toBe(true);
    expect(isDomainPending(domain({ state: 'active' }))).toBe(false);
    expect(isDomainPending(domain({ state: 'failed' }))).toBe(false);
    expect(isDomainPending(null)).toBe(false);
  });
});
