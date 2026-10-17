import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * The agency demo (`/agency?demo=1`): every page draws from `lib/demo/agency` with no request
 * sent, the plan gate asks for no entitlements, and every write is refused with the website
 * demo's toast.
 */

const network = vi.hoisted(() => ({ request: vi.fn(), getWebsites: vi.fn(), useEntitlements: vi.fn(() => ({ data: undefined })) }));
const toasts = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
const nav = vi.hoisted(() => ({ pathname: '/agency' }));

vi.mock('@/lib/api', () => ({ default: { request: network.request } }));
vi.mock('@/features/websites/api', () => ({ getWebsites: network.getWebsites }));
vi.mock('@/features/suite/queries', () => ({ useEntitlements: network.useEntitlements }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

import AgencyLayout from '@/app/agency/layout';
import { AGENCY_DEMO_STORAGE_KEY, isAgencyDemo } from '@/lib/demo/agency-mode';
import { renderWithClient } from './harness';
import { OverviewView } from '../OverviewView';
import { ClientsView } from '../ClientsView';
import { ClientDetailView } from '../ClientDetailView';
import { WebsitesView } from '../WebsitesView';
import { BrandingView } from '../BrandingView';
import { UsageView } from '../UsageView';
import { ApiView } from '../ApiView';

function visit(url: string) {
  window.history.replaceState({}, '', url);
  nav.pathname = new URL(url, 'http://localhost').pathname;
}

const inWorkspace = (page: ReactNode) => renderWithClient(<AgencyLayout>{page}</AgencyLayout>);

function expectNoNetwork() {
  expect(network.request).not.toHaveBeenCalled();
  expect(network.getWebsites).not.toHaveBeenCalled();
  expect(network.useEntitlements).not.toHaveBeenCalled();
}

const expectDemoToast = () =>
  expect(toasts.info).toHaveBeenCalledWith('Demo Mode', { description: 'Changes are not saved in demo mode. Sign up to get started!' });

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  // Landing on ?demo=1 switches the demo on for the session; later visits have no query.
  visit('/agency?demo=1');
  isAgencyDemo();
});

afterEach(() => visit('/'));

describe('agency demo: pages', () => {
  it('overview: the agency at a glance, with alerts and movers, and the demo badge', async () => {
    inWorkspace(<OverviewView />);
    expect(await screen.findByRole('link', { name: 'Acme Outdoor Co' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nova SaaS' })).toBeTruthy();
    const alerts = screen.getByTestId('alerts');
    expect(within(alerts).getByText('80% of cap')).toBeTruthy();
    expect(within(alerts).getByText('Tracking stopped')).toBeTruthy();
    expect(within(alerts).getByText('Cap reached')).toBeTruthy();
    expect(within(screen.getByTestId('movers')).getByRole('link', { name: 'Nova app' })).toBeTruthy();
    expect(within(screen.getByTestId('movers')).getAllByText('Lumen Law').length).toBeGreaterThan(0);
    expect(screen.getByText('6.2M')).toBeTruthy();
    expect(screen.getByText('Setup: 4 of 5 steps done.')).toBeTruthy();
    expect(screen.getAllByTestId('agency-demo-badge').length).toBeGreaterThan(0);
    // Site links open the website demo, which needs no sign-in.
    expect(screen.getByRole('link', { name: 'Open site' }).getAttribute('href')).toBe('/websites/demo');
    expectNoNetwork();
  });

  it('clients: the active clients, and the archived one under its tab', async () => {
    visit('/agency/clients');
    inWorkspace(<ClientsView />);
    for (const name of ['Acme Outdoor Co', 'Bloom Dental', 'Harbor Coffee', 'Verde Kitchens']) expect(await screen.findByText(name)).toBeTruthy();
    expect(screen.queryByText('Old Client Ltd')).toBeNull();
    expectNoNetwork();
  });

  it('client detail: its websites, features and embed links', async () => {
    visit('/agency/clients/cl_acme');
    inWorkspace(<ClientDetailView clientId="cl_acme" />);
    expect(await screen.findByRole('heading', { name: 'Acme Outdoor Co' })).toBeTruthy();
    expect(await screen.findByText('Acme Outdoor shop')).toBeTruthy();
    expect(screen.getByText('Trail finder')).toBeTruthy();
    expect(((await screen.findByLabelText('Embed link')) as HTMLInputElement).value).toContain('reports.northwind.agency/embed/cl_acme');
    expectNoNetwork();
  });

  it('websites: every site, the unassigned ones included', async () => {
    visit('/agency/websites');
    inWorkspace(<WebsitesView />);
    expect(await screen.findByText('Pitch sandbox')).toBeTruthy();
    expect(screen.getByText('Nova app')).toBeTruthy();
    expect(screen.getByText('Showroom microsite')).toBeTruthy();
    expectNoNetwork();
  });

  it('branding: Northwind Digital, served from its live custom domain', async () => {
    visit('/agency/branding');
    inWorkspace(<BrandingView />);
    expect(await screen.findByDisplayValue('Northwind Digital')).toBeTruthy();
    expect(screen.getByDisplayValue('northwind')).toBeTruthy();
    expect((await screen.findByTestId('domain-state')).textContent).toContain('Active');
    expect(screen.getAllByText('reports.northwind.agency').length).toBeGreaterThan(0);
    expectNoNetwork();
  });

  it('branding: ?domain=pending shows a domain waiting for DNS', async () => {
    visit('/agency/branding?domain=pending');
    window.sessionStorage.setItem(AGENCY_DEMO_STORAGE_KEY, '1');
    inWorkspace(<BrandingView />);
    expect((await screen.findByTestId('domain-state')).textContent).toContain('Waiting for DNS');
    expectNoNetwork();
  });

  it('usage: the pool, and usage by client and by website', async () => {
    visit('/agency/usage');
    inWorkspace(<UsageView />);
    expect(await screen.findByTestId('usage-events')).toBeTruthy();
    expect(within(screen.getByTestId('usage-events')).getByText('15M')).toBeTruthy();
    const byClient = screen.getByTestId('usage-clients');
    expect(await within(byClient).findByText('Nova SaaS')).toBeTruthy();
    expect(within(byClient).getByText('81% events')).toBeTruthy();
    expect(within(byClient).getByText('100% events')).toBeTruthy();
    expect(await within(screen.getByTestId('usage-websites')).findByText('Nova app')).toBeTruthy();
    expectNoNetwork();
  });

  it('API: the reference renders, with keys pointing at the website demo', async () => {
    visit('/agency/api');
    inWorkspace(<ApiView />);
    expect(await screen.findAllByText(/agency/i)).toBeTruthy();
    expectNoNetwork();
  });
});

describe('agency demo: writes are refused', () => {
  it('creating a client shows the demo toast and creates nothing', async () => {
    visit('/agency/clients');
    inWorkspace(<ClientsView />);
    await screen.findByText('Acme Outdoor Co');
    fireEvent.click(screen.getAllByRole('button', { name: /New client/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getAllByRole('textbox')[0]!, { target: { value: 'Test Co' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create client' }));
    expectDemoToast();
    expect(toasts.success).not.toHaveBeenCalled();
    expectNoNetwork();
  });

  it('saving branding shows the demo toast', async () => {
    visit('/agency/branding');
    inWorkspace(<BrandingView />);
    await screen.findByDisplayValue('Northwind Digital');
    fireEvent.click(screen.getByRole('button', { name: 'Save branding' }));
    expectDemoToast();
    expect(toasts.success).not.toHaveBeenCalled();
    expectNoNetwork();
  });

  it('dismissing an alert shows the demo toast', async () => {
    inWorkspace(<OverviewView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss alert: Cap reached' }));
    expectDemoToast();
    expectNoNetwork();
  });
});

describe('agency demo: entering and leaving', () => {
  it('?demo=1 is kept for the session, so moving between pages keeps the demo', () => {
    expect(isAgencyDemo()).toBe(true);
    visit('/agency/websites');
    expect(isAgencyDemo()).toBe(true);
    // Only in the workspace.
    visit('/websites/abc');
    expect(isAgencyDemo()).toBe(false);
  });

  it('without ?demo=1 the workspace is the real one', () => {
    window.sessionStorage.clear();
    visit('/agency');
    expect(isAgencyDemo()).toBe(false);
  });

  it('Exit demo leaves the demo for the session', async () => {
    inWorkspace(<OverviewView />);
    const badge = (await screen.findAllByTestId('agency-demo-badge'))[0]!;
    expect(within(badge).getByText('Demo data')).toBeTruthy();
    const exit = within(badge).getByRole('link', { name: 'Exit demo' });
    expect(exit.getAttribute('href')).toBe('/agency?demo=0');
    fireEvent.click(exit);
    expect(window.sessionStorage.getItem(AGENCY_DEMO_STORAGE_KEY)).toBeNull();
    visit('/agency?demo=0');
    expect(isAgencyDemo()).toBe(false);
  });

  it('no badge outside the demo', async () => {
    window.sessionStorage.clear();
    visit('/agency');
    network.request.mockRejectedValue(new Error('offline'));
    network.getWebsites.mockResolvedValue([]);
    inWorkspace(<div>page</div>);
    await waitFor(() => expect(screen.getByText('page')).toBeTruthy());
    expect(screen.queryByTestId('agency-demo-badge')).toBeNull();
  });
});
