import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { demoAgencyClients, demoClientUsers } from '@/lib/demo/agency';

const h = vi.hoisted(() => ({ agencyFeatures: 1 as number | undefined, useClientUsers: vi.fn() }));

vi.mock('@/lib/features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/features')>()),
  isEnterprise: true,
}));
vi.mock('@/features/suite/queries', () => ({
  useEntitlements: () => ({
    data: { products: { core: { plan: 'Agency', tier: 'agency', limits: h.agencyFeatures === undefined ? {} : { agency_features: h.agencyFeatures } } } },
  }),
}));
vi.mock('@/features/agency/queries', () => ({
  isDemoRefusal: () => false,
  useAgencyClients: () => ({ data: demoAgencyClients(), isLoading: false }),
  useUpdateClient: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
  useClientUsers: h.useClientUsers,
  useCustomDomain: () => ({ data: null }),
  useAgencyMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ClientsTab } from '@/components/agency/tabs/ClientsTab';

const setup = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <ClientsTab websiteId="w1" onOpen={vi.fn()} onEdit={vi.fn()} />
  </QueryClientProvider>,
);

beforeEach(() => {
  h.agencyFeatures = 1;
  h.useClientUsers.mockReset();
  h.useClientUsers.mockImplementation((_w: string, opts: { enabled: boolean }) => ({ data: opts.enabled ? demoClientUsers() : undefined }));
});

describe('ClientsTab Portal column', () => {
  it('counts, per client, the people whose access is not revoked', () => {
    setup();
    expect(screen.getByRole('columnheader', { name: 'Portal' })).toBeTruthy();
    // Northwind, Bloom and Atlas have one each; Harbor's only user is revoked.
    const live = demoClientUsers().filter(u => u.status !== 'revoked');
    expect(screen.getAllByText('with portal access')).toHaveLength(live.length);
  });

  it('is gone, and nothing is asked, without the Agency plan', () => {
    h.agencyFeatures = undefined;
    setup();
    expect(screen.getByText('Pixel Pet Supplies')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Portal' })).toBeNull();
    expect(h.useClientUsers).toHaveBeenCalledWith('w1', { enabled: false });
  });
});
