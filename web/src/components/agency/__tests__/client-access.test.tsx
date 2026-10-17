import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClientUser, CustomDomain, IssuedClientUserLink, PortalLink } from '@/features/agency/types';
import { demoAgencyClients } from '@/lib/demo/agency';

/** Cloud, on the Agency plan, on a real website: the real queries, over a mocked API. */
const h = vi.hoisted(() => ({
  users: [] as ClientUser[],
  domain: null as CustomDomain | null,
  create: vi.fn(),
  resend: vi.fn(),
  revoke: vi.fn(),
  generate: vi.fn(),
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
  listClientUsers: async () => h.users,
  getCustomDomain: async () => h.domain,
  createClientUser: h.create,
  resendClientUserLink: h.resend,
  revokeClientUser: h.revoke,
  createPortalLink: h.generate,
}));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [] }));

import { ClientPortalPanel } from '@/components/agency/client-sections';

const client = demoAgencyClients()[0]!;
const user = (over: Partial<ClientUser>): ClientUser => ({
  id: 'u1', clientId: client.id, email: 'maya@northwind.test', name: 'Maya', status: 'invited',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', lastSeenAt: null, linkExpiresAt: '2026-10-31T00:00:00Z', ...over,
});
const link = (token: string): PortalLink => ({
  id: 't1', clientId: client.id, token, portalUrl: `https://seentics.com/client-portal/${token}`,
  expiresAt: '2026-10-31T00:00:00Z', createdAt: '2026-10-01T00:00:00Z',
});
const activeDomain: CustomDomain = {
  hostname: 'reports.meridian.test', state: 'active', reason: null, cnameTarget: 'portal.seentics.com',
  ownershipVerification: null, createdAt: '', updatedAt: '', lastCheckedAt: null,
};

const setup = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ClientPortalPanel websiteId="w1" client={client} />
  </QueryClientProvider>,
);

beforeEach(() => {
  h.users = [];
  h.domain = null;
  for (const f of [h.create, h.resend, h.revoke, h.generate]) f.mockReset();
});

describe('client access panel', () => {
  it('lists the client users with their status', async () => {
    h.users = [user({}), user({ id: 'u2', email: 'ex@northwind.test', name: '', status: 'revoked', linkExpiresAt: null })];
    setup();
    expect(await screen.findByText('Invited')).toBeTruthy();
    expect(screen.getByText('Revoked')).toBeTruthy();
    expect(screen.getByText('Access revoked')).toBeTruthy();
  });

  it('invites by email and shows the magic link once, on the agency domain when it is active', async () => {
    h.domain = activeDomain;
    h.create.mockResolvedValue({ clientUser: user({}), link: link('scp_new') } satisfies IssuedClientUserLink);
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Invite/ }));
    const email = await screen.findByLabelText(/Email/);
    expect((email as HTMLInputElement).value).toBe(client.email);
    fireEvent.change(email, { target: { value: 'maya@northwind.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Create link/ }));
    await waitFor(() => expect(h.create).toHaveBeenCalled());
    expect(h.create.mock.calls[0]![0]).toEqual({ clientId: client.id, email: 'maya@northwind.test', name: undefined });
    expect(await screen.findByText('https://reports.meridian.test/client-portal/scp_new')).toBeTruthy();
    expect(screen.getByText(/won.t be shown again/)).toBeTruthy();
    // No password anywhere: it is a link.
    expect(screen.queryByText(/password/i)).toBeNull();
  });

  it('resends a link from the menu and shows the fresh one', async () => {
    h.users = [user({ status: 'active', lastSeenAt: '2026-10-10T00:00:00Z' })];
    h.resend.mockResolvedValue({ clientUser: user({ status: 'active' }), link: link('scp_fresh') });
    setup();
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Actions for maya@northwind.test' }), { key: 'Enter' });
    fireEvent.click(await screen.findByText('Resend link'));
    await waitFor(() => expect(h.resend).toHaveBeenCalled());
    expect(h.resend.mock.calls[0]![0]).toBe('u1');
    expect(await screen.findByText('https://seentics.com/client-portal/scp_fresh')).toBeTruthy();
    expect(screen.getByText(/earlier links have stopped working/)).toBeTruthy();
  });

  it('offers no resend or revoke for a revoked user', async () => {
    h.users = [user({ status: 'revoked', linkExpiresAt: null })];
    setup();
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Actions for maya@northwind.test' }), { key: 'Enter' });
    expect(await screen.findByText('Delete')).toBeTruthy();
    expect(screen.queryByText('Resend link')).toBeNull();
    expect(screen.queryByText('Revoke access')).toBeNull();
  });

  it('generates the anonymous link, on Seentics\' host while the domain is pending', async () => {
    h.domain = { ...activeDomain, state: 'pending_dns' };
    h.generate.mockResolvedValue(link('scp_anon'));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Generate link/ }));
    expect(await screen.findByText('https://seentics.com/client-portal/scp_anon')).toBeTruthy();
    expect(h.generate.mock.calls[0]![0]).toBe(client.id);
  });
});
