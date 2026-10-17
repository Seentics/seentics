import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

const plan = vi.hoisted(() => ({ enterprise: false, agency: 1 }));

vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/agency/usage' }));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [{ id: 'site-1' }] }));
vi.mock('@/lib/features', async (orig) => ({
  ...(await orig<typeof import('@/lib/features')>()),
  get isEnterprise() { return plan.enterprise; },
}));
vi.mock('@/features/suite/queries', () => ({
  useEntitlements: () => ({ data: { products: { core: { limits: { agency_features: plan.agency } } } } }),
}));

import { AGENCY_API } from '@/features/agency/agency-api-spec';
import { CLIENT, HttpError, counts, list, renderWithClient, resetApi, route, sentTo } from './harness';
import { UsageView } from '../UsageView';
import { ApiView } from '../ApiView';
import { AgencyGate } from '../AgencyGate';
import { AgencySidebar, isAgencyNavActive } from '../AgencySidebar';

const noCaps = { events: null, recordings: null, leads: null, ai_analyses: null };

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  resetApi();
  plan.enterprise = false;
  plan.agency = 1;
  try { localStorage.clear(); } catch { /* none */ }
});

describe('usage', () => {
  beforeEach(() => {
    route('GET', '/agency/usage', {
      data: {
        period: { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' },
        pool: counts(1_000_000, 10_000, 1_000, 100),
        used: counts(900_000, 2_000, 1_200, 5),
        allocated: counts(0), unallocated: counts(1_000_000, 10_000, 1_000, 100),
        overage: counts(0, 0, 200, 0),
      },
    });
    route('GET', '/agency/clients', list([CLIENT]));
    route('GET', '/agency/usage/clients', list([{ id: 'c1', name: 'Acme Bakery', used: counts(600_000, 1_000, 3, 1), cap: noCaps, pct: noCaps }]));
    route('GET', '/agency/usage/websites', req => list(req.params?.client_id === 'c1'
      ? [{ id: 'w1', name: 'acme.test', client_id: 'c1', used: counts(600_000), cap: noCaps, pct: noCaps }]
      : [{ id: 'w1', name: 'acme.test', client_id: 'c1', used: counts(600_000), cap: noCaps, pct: noCaps }, { id: 'w9', name: 'loose.test', client_id: null, used: counts(300_000), cap: noCaps, pct: noCaps }]));
  });

  it('shows pool against use per resource, and per client and website', async () => {
    renderWithClient(<UsageView />);
    expect(await screen.findByRole('group', { name: 'Events' })).toHaveTextContent('90% of 1M');
    expect(screen.getByRole('group', { name: 'Leads' })).toHaveTextContent('120% of 1K');
    expect(screen.getByTestId('usage-leads')).toHaveTextContent('200');
    expect(screen.getByRole('meter', { name: 'Events used' })).toHaveAttribute('aria-valuenow', '90');
    const byClient = screen.getByTestId('usage-clients');
    expect(await within(byClient).findByText('Acme Bakery')).toBeTruthy();
    expect(within(byClient).getByText('No cap')).toBeTruthy();
    const bySite = screen.getByTestId('usage-websites');
    expect(await within(bySite).findByText('loose.test')).toBeTruthy();
    expect(screen.getByText(/1 Oct to 1 Nov 2026/)).toBeTruthy();
  });

  it('filters websites by client', async () => {
    renderWithClient(<UsageView />);
    await screen.findByText('loose.test');
    fireEvent.pointerDown(screen.getByRole('combobox', { name: 'Filter websites by client' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('option', { name: 'Acme Bakery' }));
    await waitFor(() => expect(screen.queryByText('loose.test')).toBeNull());
    expect(sentTo('GET', '/agency/usage/websites').some(s => s.params?.client_id === 'c1')).toBe(true);
  });
});

describe('API page', () => {
  it('renders the quick start and every endpoint from the spec, with scopes and both languages', async () => {
    renderWithClient(<ApiView />);
    const quick = screen.getByTestId('api-quick-start');
    expect(quick).toHaveTextContent('curl -X POST "https://api.seentics.com/api/v1/agency/clients"');
    expect(quick).toHaveTextContent('Idempotency-Key');
    for (const ep of AGENCY_API) {
      const el = screen.getByTestId(`endpoint-${ep.id}`);
      expect(el).toHaveTextContent(ep.path);
      expect(el).toHaveTextContent(ep['x-scope']);
    }
    fireEvent.click(screen.getByRole('tab', { name: 'Node' }));
    expect(quick).toHaveTextContent("await fetch('https://api.seentics.com/api/v1/agency/clients'");
    expect(screen.getByTestId('api-auth')).toHaveTextContent('agency:read');
    expect(screen.getByTestId('api-auth')).toHaveTextContent('agency:write');
    await waitFor(() => expect(screen.getByRole('link', { name: /Create an API key/ })).toHaveAttribute('href', '/websites/site-1/developers?new=agency'));
    expect(quick).toHaveTextContent('Agency API preset');
    expect(screen.getByRole('link', { name: /create an account key with the Agency API preset/ })).toHaveAttribute('href', '/websites/site-1/developers?new=agency');
  });
});

describe('plan gate and sidebar', () => {
  it('shows the Agency plan prompt to accounts without the plan', async () => {
    plan.enterprise = true;
    plan.agency = 0;
    route('GET', '/agency/setup', { data: { steps: [] } });
    renderWithClient(<AgencyGate><p>workspace</p></AgencyGate>);
    expect(screen.getByTestId('agency-plan-prompt')).toBeTruthy();
    expect(screen.queryByText('workspace')).toBeNull();
  });

  it('shows the prompt when the API refuses with agency_plan_required', async () => {
    plan.enterprise = true;
    route('GET', '/agency/setup', () => new HttpError(403, 'agency_plan_required'));
    renderWithClient(<AgencyGate><p>workspace</p></AgencyGate>);
    expect(await screen.findByTestId('agency-plan-prompt')).toBeTruthy();
  });

  it('lets Agency accounts in', async () => {
    plan.enterprise = true;
    route('GET', '/agency/setup', { data: { steps: [] } });
    renderWithClient(<AgencyGate><p>workspace</p></AgencyGate>);
    expect(screen.getByText('workspace')).toBeTruthy();
  });

  it('links every workspace page and the way back to the dashboard', async () => {
    localStorage.setItem('seentics:last-website', 'site-7');
    renderWithClient(<AgencySidebar />);
    const nav = screen.getAllByRole('complementary', { name: 'Agency' })[0]!;
    for (const [label, href] of [['Overview', '/agency'], ['Clients', '/agency/clients'], ['Websites', '/agency/websites'], ['Branding & domain', '/agency/branding'], ['Usage', '/agency/usage'], ['API', '/agency/api']]) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(within(nav).getByRole('link', { name: 'Usage' })).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(within(nav).getByRole('link', { name: /Back to dashboard/ })).toHaveAttribute('href', '/websites/site-7'));
    expect(isAgencyNavActive('/agency', '/agency/clients')).toBe(false);
    expect(isAgencyNavActive('/agency/clients', '/agency/clients/c1')).toBe(true);
  });
});
