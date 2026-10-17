import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/agency/clients' }));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [] }));

import { CLIENT, HttpError, list, renderWithClient, resetApi, route, sentTo } from './harness';
import { ClientsView } from '../ClientsView';

const BOLT = { ...CLIENT, id: 'c2', name: 'Bolt Gym', company: '', website_count: 0, status: 'archived' as const };

/** Radix menus open on pointerdown, which jsdom's click alone does not send. */
function openMenu(name: string) {
  const trigger = screen.getByRole('button', { name });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
}

beforeEach(() => {
  resetApi();
  push.mockReset();
  window.history.replaceState(null, '', '/agency/clients');
  route('GET', '/agency/clients', req => {
    const p = req.params ?? {};
    if (p.status === 'archived') return list([BOLT]);
    if (p.q === 'zzz') return list([]);
    return list([CLIENT]);
  });
});

describe('clients list', () => {
  it('lists active clients and opens one on click', async () => {
    renderWithClient(<ClientsView />);
    const row = await screen.findByText('Acme Bakery');
    expect(screen.getByText('Acme Ltd')).toBeTruthy();
    expect(sentTo('GET', '/agency/clients')[0]!.params).toMatchObject({ status: 'active' });
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith('/agency/clients/c1');
  });

  it('filters by archived and searches on the server', async () => {
    renderWithClient(<ClientsView />);
    await screen.findByText('Acme Bakery');
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));
    expect(await screen.findByText('Bolt Gym')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Active' }));
    fireEvent.change(screen.getByLabelText('Search clients'), { target: { value: 'zzz' } });
    expect(await screen.findByText('No matches')).toBeTruthy();
    expect(sentTo('GET', '/agency/clients').some(s => s.params?.q === 'zzz')).toBe(true);
  });

  it('creates a client with an Idempotency-Key and opens it', async () => {
    route('POST', '/agency/clients', req => ({ data: { ...CLIENT, id: 'c9', name: (req.data as { name: string }).name } }));
    renderWithClient(<ClientsView />);
    await screen.findByText('Acme Bakery');
    fireEvent.click(screen.getByRole('button', { name: /New client/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Cedar Dental' } });
    fireEvent.change(screen.getByLabelText(/Company/), { target: { value: 'Cedar LLC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/agency/clients/c9'));
    const sent = sentTo('POST', '/agency/clients')[0]!;
    expect(sent.data).toEqual({ name: 'Cedar Dental', company: 'Cedar LLC', notes: '' });
    expect(sent.headers?.['Idempotency-Key']).toMatch(/[0-9a-f-]{20,}/);
  });

  it('opens the create dialog from the setup guide link', async () => {
    window.history.replaceState(null, '', '/agency/clients?new=1');
    renderWithClient(<ClientsView />);
    expect(await screen.findByRole('dialog')).toHaveTextContent('New client');
  });

  it('shows the server’s validation message when create fails', async () => {
    route('POST', '/agency/clients', () => new HttpError(422, 'validation_failed', 'name: Must not contain control characters'));
    renderWithClient(<ClientsView />);
    await screen.findByText('Acme Bakery');
    fireEvent.click(screen.getByRole('button', { name: /New client/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
    expect(await screen.findByText('name: Must not contain control characters')).toBeTruthy();
  });

  it('archives and unarchives from the row menu', async () => {
    route('POST', '/agency/clients/c1/archive', { data: { ...CLIENT, status: 'archived' } });
    route('POST', '/agency/clients/c2/unarchive', { data: { ...BOLT, status: 'active' } });
    renderWithClient(<ClientsView />);
    await screen.findByText('Acme Bakery');
    openMenu('Actions for Acme Bakery');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() => expect(sentTo('POST', '/agency/clients/c1/archive')).toHaveLength(1));

    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));
    await screen.findByText('Bolt Gym');
    openMenu('Actions for Bolt Gym');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Unarchive/ }));
    await waitFor(() => expect(sentTo('POST', '/agency/clients/c2/unarchive')).toHaveLength(1));
  });

  it('deletes only after confirming, with confirm=true', async () => {
    route('DELETE', '/agency/clients/c1', null);
    renderWithClient(<ClientsView />);
    await screen.findByText('Acme Bakery');
    openMenu('Actions for Acme Bakery');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete Acme Bakery?');
    expect(dialog).toHaveTextContent('website stays');
    expect(sentTo('DELETE', '/agency/clients/c1')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Delete client' }));
    await waitFor(() => expect(sentTo('DELETE', '/agency/clients/c1')).toHaveLength(1));
    expect(sentTo('DELETE', '/agency/clients/c1')[0]!.params).toEqual({ confirm: true });
  });
});
