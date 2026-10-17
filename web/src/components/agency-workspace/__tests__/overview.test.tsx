import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/agency' }));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [] }));

import { HttpError, counts, renderWithClient, resetApi, route, sentTo } from './harness';
import { OverviewView, changePct } from '../OverviewView';

const steps = (done: string[]) =>
  ['branding', 'first_client', 'website_installed', 'client_user', 'features_limits'].map(id => ({ id, done: done.includes(id) }));

const USAGE = {
  period: { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' },
  pool: counts(1_000_000, 10_000, 1_000, 100),
  used: counts(250_000, 2_500, 10, 1),
  allocated: counts(0), unallocated: counts(1_000_000, 10_000, 1_000, 100), overage: counts(0),
};

const overview = (over: Record<string, unknown> = {}) => ({
  period: { key: '30d', start: '2026-09-17', end: '2026-10-16', previous_start: '2026-08-18', previous_end: '2026-09-16' },
  totals: { visitors: 3000, events: 250_000, leads: 12 },
  previous_totals: { visitors: 2000, events: 200_000, leads: 10 },
  clients: [
    { id: 'c1', name: 'Acme Bakery', status: 'active', website_count: 2, totals: { visitors: 2500, events: 200_000 }, previous_totals: { visitors: 2000, events: 150_000 } },
    { id: 'c2', name: 'Bolt Gym', status: 'archived', website_count: 1, totals: { visitors: 500 }, previous_totals: {} },
    { id: null, name: 'Not assigned', status: null, website_count: 1, totals: { visitors: 0 }, previous_totals: {} },
  ],
  top_movers: [{ website_id: 'w2', website_name: 'bolt.test', client_id: 'c2', metric: 'visitors', current: 500, previous: 1000, change_pct: -50 }],
  alerts: [{ id: 'a1', kind: 'tracking_stopped', client_id: 'c2', website_id: 'w2', resource: 'events', period: '2026-10-16', created_at: '2026-10-16T00:00:00Z', dismissed_at: null }],
  generated_at: '2026-10-17T00:00:00Z',
  ...over,
});

beforeEach(() => {
  resetApi();
  route('GET', '/agency/setup', { data: { steps: steps(['branding', 'first_client', 'website_installed', 'client_user', 'features_limits']) } });
  route('GET', '/agency/usage', { data: USAGE });
});

describe('agency overview', () => {
  it('shows totals, events against the pool, the client table with trends, movers and alerts', async () => {
    route('GET', '/agency/overview', { data: overview() });
    renderWithClient(<OverviewView />);
    expect(await screen.findByRole('group', { name: 'Clients' })).toHaveTextContent('2');
    expect(screen.getByRole('group', { name: 'Clients' })).toHaveTextContent('1 active');
    expect(screen.getByRole('group', { name: 'Websites' })).toHaveTextContent('1 not assigned');
    expect(screen.getByRole('group', { name: 'Visitors' })).toHaveTextContent('+50.0%');
    await waitFor(() => expect(screen.getByRole('group', { name: 'Events this month' })).toHaveTextContent('25% of 1M pool'));
    expect(screen.getByRole('link', { name: 'Acme Bakery' })).toHaveAttribute('href', '/agency/clients/c1');
    expect(screen.getByText('+25.0%')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Not assigned' })).toBeNull();
    expect(within(screen.getByTestId('movers')).getByRole('link', { name: 'bolt.test' })).toHaveAttribute('href', '/websites/w2');
    expect(within(screen.getByTestId('movers')).getByText('-50.0%')).toBeTruthy();
    expect(within(screen.getByTestId('alerts')).getByText(/Bolt Gym: no events in the last 24 hours/)).toBeTruthy();
    expect(screen.queryByTestId('setup-guide')).toBeNull();
    expect(sentTo('GET', '/agency/overview')[0]!.params).toEqual({ period: '30d' });
  });

  it('dismisses an alert and refreshes', async () => {
    let dismissed = false;
    route('GET', '/agency/overview', () => ({ data: overview(dismissed ? { alerts: [] } : {}) }));
    route('POST', '/agency/alerts/a1/dismiss', () => { dismissed = true; return { data: { id: 'a1' } }; });
    renderWithClient(<OverviewView />);
    fireEvent.click(await screen.findByRole('button', { name: /Dismiss alert/ }));
    await waitFor(() => expect(screen.getByText('No alerts')).toBeTruthy());
    expect(sentTo('POST', '/agency/alerts/a1/dismiss')[0]!.headers?.['Idempotency-Key']).toBeTruthy();
  });

  it('shows the setup guide, with progress and links, when there are no clients', async () => {
    route('GET', '/agency/setup', { data: { steps: steps(['branding']) } });
    route('GET', '/agency/overview', { data: overview({ clients: [], top_movers: [], alerts: [], totals: {}, previous_totals: {} }) });
    renderWithClient(<OverviewView />);
    const guide = await screen.findByTestId('setup-guide');
    await waitFor(() => expect(guide).toHaveTextContent('1 of 5 done'));
    expect(screen.getByTestId('setup-step-branding')).toHaveAttribute('data-done', 'true');
    expect(screen.getByTestId('setup-step-first_client')).toHaveAttribute('data-done', 'false');
    expect(within(screen.getByTestId('setup-step-first_client')).getByRole('link', { name: /Add a client/ })).toHaveAttribute('href', '/agency/clients?new=1');
    expect(within(screen.getByTestId('setup-step-website_installed')).getByRole('link')).toHaveAttribute('href', '/agency/websites');
    expect(within(screen.getByTestId('setup-step-client_user')).queryByText(/next update/)).toBeNull();
    expect(within(screen.getByTestId('setup-step-client_user')).getByRole('link')).toHaveAttribute('href', '/agency/clients');
    expect(within(screen.getByTestId('setup-step-features_limits')).getByRole('link')).toHaveAttribute('href', '/agency/clients');
    expect(within(screen.getByTestId('setup-step-branding')).queryByRole('link')).toBeNull();
  });

  it('accepts the setup steps wrapped with counts too', async () => {
    route('GET', '/agency/setup', { data: { steps: steps(['branding', 'first_client']) } });
    route('GET', '/agency/overview', { data: overview({ clients: [] }) });
    renderWithClient(<OverviewView />);
    await waitFor(() => expect(screen.getByTestId('setup-guide')).toHaveTextContent('2 of 5 done'));
  });

  it('says why when the overview fails', async () => {
    route('GET', '/agency/overview', () => new HttpError(429, 'rate_limited'));
    renderWithClient(<OverviewView />);
    expect(await screen.findByText(/Too many requests/)).toBeTruthy();
  });

  it('computes change against the previous period', () => {
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(5, 0)).toBeNull();
    expect(changePct(undefined, 10)).toBe(-100);
  });
});
