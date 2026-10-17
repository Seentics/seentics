import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/agency/clients/c1' }));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [] }));

import { FEATURE_IDS } from '@/features/agency/constants';
import { CLIENT, INSTALL, SITE, list, renderWithClient, resetApi, route, sentTo } from './harness';
import { ClientDetailView } from '../ClientDetailView';

const FEATURES = Object.fromEntries(FEATURE_IDS.map(id => [id, id === 'overview' ? 'view' : 'off']));
const EMBED = {
  id: 'e1', scope: 'client', target_id: 'c1', target_name: 'Acme Bakery', token: 't', embed_url: 'https://seentics.com/embed/w1?token=t',
  sections: ['analytics'], created_at: '2026-10-01T00:00:00Z',
};

let embeds: typeof EMBED[] = [];

beforeEach(() => {
  resetApi();
  embeds = [];
  route('GET', '/agency/clients/c1', { data: { ...CLIENT, notes: 'Renews in March', websites: [SITE] } });
  route('GET', '/agency/clients/c1/websites', list([SITE]));
  route('GET', '/agency/clients/c1/features', { data: { features: FEATURES } });
  route('GET', '/agency/clients', list([CLIENT]));
  route('GET', '/agency/embeds', () => list(embeds));
  route('GET', '/agency/websites/w1/install', { data: INSTALL });
});

describe('client detail', () => {
  it('shows the client, its details and its websites', async () => {
    renderWithClient(<ClientDetailView clientId="c1" />);
    expect(await screen.findByRole('heading', { name: 'Acme Bakery' })).toBeTruthy();
    expect(screen.getByText('Renews in March')).toBeTruthy();
    expect(await screen.findByText('Acme site')).toBeTruthy();
    expect(screen.getByText('Not installed')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/websites/w1');
    expect(screen.queryByText(/Client sign-in —/)).toBeNull();
  });

  it('edits the details', async () => {
    route('PATCH', '/agency/clients/c1', req => ({ data: { ...CLIENT, ...(req.data as object) } }));
    renderWithClient(<ClientDetailView clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit details/ }));
    const name = await screen.findByLabelText('Name');
    expect((name as HTMLInputElement).value).toBe('Acme Bakery');
    fireEvent.change(name, { target: { value: 'Acme Bakeries' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(sentTo('PATCH', '/agency/clients/c1')).toHaveLength(1));
    expect(sentTo('PATCH', '/agency/clients/c1')[0]!.data).toEqual({ name: 'Acme Bakeries', company: 'Acme Ltd', notes: 'Renews in March' });
  });

  it('adds a website, shows its snippet, and verifies the install', async () => {
    route('POST', '/agency/clients/c1/websites', req => ({ data: { website: { ...SITE, id: 'w2', ...(req.data as object) }, install: { ...INSTALL, website_id: 'w2' } } }));
    route('POST', '/agency/websites/w2/verify', { data: { status: 'receiving', is_verified: true, last_event_at: new Date().toISOString(), events_24h: 42 } });
    renderWithClient(<ClientDetailView clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add website/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Shop' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://shop.acme.test' } });
    expect(screen.queryByLabelText('Client')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add website' }));

    const panel = await screen.findByTestId('install-panel');
    expect(sentTo('POST', '/agency/clients/c1/websites')[0]!.data).toEqual({ name: 'Shop', url: 'https://shop.acme.test' });
    expect(sentTo('POST', '/agency/clients/c1/websites')[0]!.headers?.['Idempotency-Key']).toBeTruthy();
    expect(within(panel).getByText(INSTALL.snippet_html)).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Copy snippet' })).toBeTruthy();
    expect(within(panel).getByTestId('verification-status')).toHaveTextContent('No events yet');
    fireEvent.click(within(panel).getByRole('tab', { name: 'WordPress' }));
    expect(within(panel).getByTestId('install-instructions')).toHaveTextContent('wp steps');

    fireEvent.click(within(panel).getByRole('button', { name: /Verify installation/ }));
    await waitFor(() => expect(within(panel).getByTestId('verification-status')).toHaveTextContent('Receiving events'));
    expect(within(panel).getByText(/42 events in 24 hours/)).toBeTruthy();
  });

  it('opens the install drawer for an existing site', async () => {
    renderWithClient(<ClientDetailView clientId="c1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Install Acme site' }));
    const panel = await screen.findByTestId('install-panel');
    expect(within(panel).getByText('ST-1')).toBeTruthy();
  });

  it('saves the features matrix and explains enforcement comes with client sign-in', async () => {
    route('PUT', '/agency/clients/c1/features', req => ({ data: req.data }));
    renderWithClient(<ClientDetailView clientId="c1" />);
    const matrix = await screen.findByTestId('features-matrix');
    expect(matrix).toHaveTextContent(/take effect when client sign-in arrives/);
    const save = within(matrix).getByRole('button', { name: 'Save features' });
    await waitFor(() => expect(within(matrix).getByRole('radio', { name: 'Overview: View' })).toHaveAttribute('aria-checked', 'true'));
    expect(save).toBeDisabled();
    fireEvent.click(within(matrix).getByRole('radio', { name: 'Revenue: Edit' }));
    fireEvent.click(within(matrix).getByRole('radio', { name: 'Recordings: View' }));
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(sentTo('PUT', '/agency/clients/c1/features')).toHaveLength(1));
    const body = sentTo('PUT', '/agency/clients/c1/features')[0]!.data as { features: Record<string, string> };
    expect(Object.keys(body.features)).toHaveLength(14);
    expect(body.features).toMatchObject({ overview: 'view', revenue: 'edit', recordings: 'view', goals: 'off' });
  });

  it('creates a client embed link and changes its sections', async () => {
    route('POST', '/agency/embeds', req => { embeds = [{ ...EMBED, ...(req.data as object) } as typeof EMBED]; return { data: embeds[0] }; });
    route('PATCH', '/agency/embeds/e1', req => { embeds = [{ ...EMBED, ...(req.data as object) } as typeof EMBED]; return { data: embeds[0] }; });
    renderWithClient(<ClientDetailView clientId="c1" />);
    const panel = await screen.findByTestId('embeds-panel');
    fireEvent.click(await within(panel).findByRole('button', { name: /Create embed link/ }));
    expect(await within(panel).findByDisplayValue(EMBED.embed_url)).toBeTruthy();
    expect(sentTo('POST', '/agency/embeds')[0]!.data).toEqual({ scope: 'client', target_id: 'c1', sections: ['analytics'] });
    expect(sentTo('GET', '/agency/embeds')[0]!.params).toMatchObject({ scope: 'client', target_id: 'c1' });
    fireEvent.click(within(panel).getByRole('switch', { name: 'Show Heatmaps' }));
    await waitFor(() => expect(sentTo('PATCH', '/agency/embeds/e1')).toHaveLength(1));
    expect(sentTo('PATCH', '/agency/embeds/e1')[0]!.data).toEqual({ sections: ['analytics', 'heatmaps'] });
  });
});
