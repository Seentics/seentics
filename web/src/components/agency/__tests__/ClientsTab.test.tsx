import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { demoAgencyClients, demoClientUsers } from '@/lib/demo/agency';

vi.mock('@/features/agency/queries', () => ({
  isDemoRefusal: () => false,
  useAgencyClients: () => ({ data: demoAgencyClients(), isLoading: false }),
  useUpdateClient: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ClientsTab } from '@/components/agency/tabs/ClientsTab';

describe('ClientsTab Login column', () => {
  it('marks exactly the clients whose email matches a login (demo mode shows logins)', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ClientsTab websiteId="demo" onOpen={vi.fn()} onEdit={vi.fn()} />
      </QueryClientProvider>,
    );
    const marks = await screen.findAllByText('Has login');
    expect(marks).toHaveLength(demoClientUsers().length);
    const titles = marks.map(m => m.parentElement!.getAttribute('title'));
    for (const u of demoClientUsers()) expect(titles).toContain(`Login: ${u.email}`);
    // Pixel Pets and Summit have no login, so they show a dash rather than the key.
    expect(screen.getByText('Pixel Pet Supplies')).toBeTruthy();
  });
});
