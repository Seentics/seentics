import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EmbedLink } from '@/features/agency/types';

const h = vi.hoisted(() => ({
  links: [] as EmbedLink[],
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/features/agency/queries', () => ({
  isDemoRefusal: () => false,
  useAgencyClients: () => ({ data: [] }),
  useEmbedLinks: () => ({ data: h.links, isLoading: false }),
  useCreateEmbedLink: () => ({ mutate: h.create, isPending: false }),
  useRevokeEmbedLink: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEmbedLink: () => ({ mutate: h.update, isPending: false }),
}));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [{ id: 'w1', name: 'Shop', url: 'shop.test' }] }));

import { EmbedsTab } from '@/components/agency/tabs/EmbedsTab';

const link = (sections: EmbedLink['sections']): EmbedLink => ({
  id: 'l1', scope: 'website', targetId: 'w1', targetName: 'Shop', token: 't',
  embedUrl: '/embed/w1?token=t', sections, createdAt: '2026-01-01T00:00:00Z',
});

const setup = () => render(
  <QueryClientProvider client={new QueryClient()}><EmbedsTab websiteId="w1" /></QueryClientProvider>,
);
const sw = (name: string) => screen.getByRole('switch', { name }) as HTMLButtonElement;

beforeEach(() => { h.links = []; h.update.mockReset(); h.create.mockReset(); });

describe('EmbedsTab "What to show"', () => {
  it('defaults a new link to analytics only, with the last switch locked', () => {
    setup();
    expect(sw('Analytics').getAttribute('aria-checked')).toBe('true');
    expect(sw('Session recordings').getAttribute('aria-checked')).toBe('false');
    expect(sw('Heatmaps').getAttribute('aria-checked')).toBe('false');
    expect(sw('Analytics').disabled).toBe(true);
    expect(screen.queryByText(/Recordings show what real visitors did/)).toBeNull();
  });

  it('draft toggles send nothing until the link is created, then create with them', () => {
    setup();
    fireEvent.click(sw('Heatmaps'));
    expect(h.update).not.toHaveBeenCalled();
    expect(sw('Heatmaps').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Create embed link/ }));
    expect(h.create.mock.calls[0]![0]).toEqual({ target: { websiteId: 'w1' }, sections: ['analytics', 'heatmaps'] });
  });

  it('toggling a section on an existing link calls update with the new sections', () => {
    h.links = [link(['analytics'])];
    setup();
    fireEvent.click(sw('Session recordings'));
    expect(h.update.mock.calls[0]![0]).toEqual({ id: 'l1', sections: ['analytics', 'recordings'] });
  });

  it('removing a section updates without it, and the sole remaining one cannot be switched off', () => {
    h.links = [link(['analytics', 'recordings'])];
    setup();
    expect(screen.getByText(/Recordings show what real visitors did/)).toBeTruthy();
    fireEvent.click(sw('Analytics'));
    expect(h.update.mock.calls[0]![0]).toEqual({ id: 'l1', sections: ['recordings'] });

    h.links = [link(['recordings'])];
    setup();
    const only = screen.getAllByRole('switch', { name: 'Session recordings' }).at(-1) as HTMLButtonElement;
    expect(only.disabled).toBe(true);
  });
});
