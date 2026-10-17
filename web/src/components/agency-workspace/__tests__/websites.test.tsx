import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/agency/websites' }));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [] }));

import { CLIENT, INSTALL, SITE, list, renderWithClient, resetApi, route, sentTo } from './harness';
import { WebsitesView } from '../WebsitesView';

const LOOSE = { ...SITE, id: 'w3', name: 'Loose site', url: 'https://loose.test', client_id: null, is_verified: true };
const BOLT = { ...CLIENT, id: 'c2', name: 'Bolt Gym' };

beforeAll(() => {
  // Radix Select measures and captures the pointer; jsdom has neither.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

/** Radix Select opens on pointerdown, then an option is clicked. */
function choose(trigger: HTMLElement, option: string) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.click(screen.getByRole('option', { name: option }));
}

beforeEach(() => {
  resetApi();
  window.history.replaceState(null, '', '/agency/websites');
  route('GET', '/agency/clients', list([CLIENT, BOLT]));
  route('GET', '/agency/websites', req => {
    if (req.params?.unassigned) return list([LOOSE]);
    if (req.params?.client_id === 'c1') return list([SITE]);
    return list([SITE, LOOSE], 'cur2');
  });
  route('GET', '/agency/websites/w1/install', { data: INSTALL });
  route('GET', '/agency/embeds', list([]));
});

describe('websites', () => {
  it('lists every website with its client, tracking state and dashboard link', async () => {
    renderWithClient(<WebsitesView />);
    expect(await screen.findByText('Acme site')).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'Acme Bakery' })).toHaveAttribute('href', '/agency/clients/c1');
    expect(screen.getByText('Not assigned')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
  });

  it('filters to unassigned websites, and by client', async () => {
    window.history.replaceState(null, '', '/agency/websites?unassigned=1');
    renderWithClient(<WebsitesView />);
    await waitFor(() => expect(sentTo('GET', '/agency/websites').some(s => s.params?.unassigned === true)).toBe(true));
    await waitFor(() => expect(screen.queryByText('Acme site')).toBeNull());
    expect(screen.getByText('Loose site')).toBeTruthy();
    choose(screen.getByRole('combobox', { name: 'Filter by client' }), 'Acme Bakery');
    expect(await screen.findByText('Acme site')).toBeTruthy();
    expect(sentTo('GET', '/agency/websites').some(s => s.params?.client_id === 'c1')).toBe(true);
  });

  it('moves a website to another client', async () => {
    route('PATCH', '/agency/websites/w1', req => ({ data: { ...SITE, ...(req.data as object) } }));
    renderWithClient(<WebsitesView />);
    await screen.findByText('Acme site');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Acme site' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Move to client/ }));
    const dialog = await screen.findByRole('dialog');
    choose(within(dialog).getByRole('combobox', { name: 'Move to client' }), 'Bolt Gym');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move website' }));
    await waitFor(() => expect(sentTo('PATCH', '/agency/websites/w1')).toHaveLength(1));
    expect(sentTo('PATCH', '/agency/websites/w1')[0]!.data).toEqual({ client_id: 'c2' });
  });

  it('opens the install drawer with snippet, tracking check and embed link', async () => {
    renderWithClient(<WebsitesView />);
    await screen.findByText('Acme site');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Acme site' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Install & embed/ }));
    expect(await screen.findByTestId('install-panel')).toHaveTextContent(INSTALL.snippet_html);
    expect(screen.getByTestId('embeds-panel')).toHaveTextContent('No embed link');
    expect(screen.getByRole('link', { name: /Open site dashboard/ })).toHaveAttribute('href', '/websites/w1');
  });

  it('creates an unassigned website and shows how to install it', async () => {
    // The site alone; the panel then reads its install.
    route('POST', '/agency/websites', req => ({ data: { ...LOOSE, id: 'w9', ...(req.data as object) } }));
    route('GET', '/agency/websites/w9/install', { data: { ...INSTALL, website_id: 'w9' } });
    renderWithClient(<WebsitesView />);
    await screen.findByText('Acme site');
    fireEvent.click(screen.getByRole('button', { name: /Add website/ }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://new.test' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add website' }));
    expect(await screen.findByTestId('install-panel')).toHaveTextContent(INSTALL.snippet_html);
    expect(sentTo('POST', '/agency/websites')[0]!.data).toEqual({ name: 'New', url: 'https://new.test', client_id: null });
  });

  it('deletes a website after confirming', async () => {
    route('DELETE', '/agency/websites/w3', null);
    renderWithClient(<WebsitesView />);
    await screen.findByText('Loose site');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Loose site' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete website' }));
    await waitFor(() => expect(sentTo('DELETE', '/agency/websites/w3')).toHaveLength(1));
  });
});
