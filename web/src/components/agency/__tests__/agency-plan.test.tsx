import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgencyClient, EmbedLink } from '@/features/agency/types';
import { demoAgencyClients } from '@/lib/demo/agency';

/** Cloud, signed in, on a real website (not the demo): the plan decides. */
const h = vi.hoisted(() => ({
  agencyFeatures: undefined as number | undefined,
  clients: [] as AgencyClient[],
  links: [] as EmbedLink[],
  create: vi.fn(),
  mutate: vi.fn(),
  whiteLabel: { isLoading: false, isError: false, error: null as unknown, data: undefined as unknown },
}));

vi.mock('@/lib/features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/features')>()),
  isEnterprise: true,
}));
vi.mock('@/features/suite/queries', () => ({
  useEntitlements: () => ({
    data: { products: { core: { plan: 'Pro', tier: 'pro', limits: h.agencyFeatures === undefined ? {} : { agency_features: h.agencyFeatures } } } },
  }),
}));
vi.mock('@/features/agency/queries', () => ({
  isDemoRefusal: () => false,
  useAgencyClients: () => ({ data: h.clients, isLoading: false }),
  useUpdateClient: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
  useEmbedLinks: () => ({ data: h.links, isLoading: false }),
  useCreateEmbedLink: () => ({ mutate: h.create, isPending: false }),
  useRevokeEmbedLink: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEmbedLink: () => ({ mutate: vi.fn(), isPending: false }),
  useClientUsers: () => ({ data: [], isLoading: false }),
  useCustomDomain: () => ({ data: null }),
  useWhiteLabel: () => h.whiteLabel,
  useAgencyMutation: () => ({ mutate: h.mutate, isPending: false }),
  agencyKeys: { whiteLabel: ['agency-white-label'], customDomain: ['agency-custom-domain'] },
}));
vi.mock('@/features/websites/api', () => ({ getWebsites: async () => [{ id: 'w1', name: 'Shop', url: 'shop.test' }] }));

import { ClientsTab } from '@/components/agency/tabs/ClientsTab';
import { EmbedsTab } from '@/components/agency/tabs/EmbedsTab';
import { WhiteLabelTab } from '@/components/agency/tabs/WhiteLabelTab';
import { ClientPortalPanel } from '@/components/agency/client-sections';
import { isAgencyPlanRequired } from '@/features/agency/plan';

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const PROMPT = 'Client workspaces and embeds are part of the Agency plan';

beforeEach(() => {
  h.agencyFeatures = undefined;
  h.clients = demoAgencyClients();
  h.links = [];
  h.create.mockReset();
  h.mutate.mockReset();
  h.whiteLabel = { isLoading: false, isError: false, error: null, data: undefined };
});

const PLAN_403 = { response: { status: 403, data: { error: 'AGENCY_PLAN_REQUIRED' } } };

describe('agency features without the Agency plan', () => {
  it('Clients: shows the upgrade prompt, and keeps existing clients listed', () => {
    wrap(<ClientsTab websiteId="w1" onOpen={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText(PROMPT)).toBeTruthy();
    expect(screen.getByRole('link', { name: /See the Agency plan/ }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByText('Pixel Pet Supplies')).toBeTruthy();
  });

  it('Clients: no prompt on the Agency plan', () => {
    h.agencyFeatures = 1;
    wrap(<ClientsTab websiteId="w1" onOpen={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByText(PROMPT)).toBeNull();
  });

  it('Embeds: the prompt takes the create button\'s place; existing links stay revocable', () => {
    h.links = [{
      id: 'l1', scope: 'website', targetId: 'w2', targetName: 'Blog', token: 't',
      embedUrl: '/embed/w2?token=t', sections: ['analytics'], createdAt: '2026-01-01T00:00:00Z',
    }];
    wrap(<EmbedsTab websiteId="w1" />);
    expect(screen.getByText(PROMPT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Create embed link/ })).toBeNull();
    expect(screen.getByText('Blog')).toBeTruthy();
    expect(screen.getByTitle('Revoke link')).toBeTruthy();
  });

  it('Embeds: a 403 AGENCY_PLAN_REQUIRED from the API brings up the prompt', async () => {
    h.agencyFeatures = 1;
    h.create.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError({ response: { status: 403, data: { error: 'AGENCY_PLAN_REQUIRED', resource: 'embed_links' } } }));
    wrap(<EmbedsTab websiteId="w1" />);
    expect(screen.queryByText(PROMPT)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Create embed link/ }));
    expect(await screen.findByText(PROMPT)).toBeTruthy();
  });
});

describe('client access and white label: the Agency plan for every action', () => {
  it('White label: the prompt instead of the form, with no settings read', () => {
    wrap(<WhiteLabelTab websiteId="w1" />);
    expect(screen.getByText('White label is part of the Agency plan')).toBeTruthy();
    expect(screen.queryByText('Save settings')).toBeNull();
    expect(screen.queryByText('Custom domain')).toBeNull();
  });

  it('White label: a 403 AGENCY_PLAN_REQUIRED on reading the settings brings up the prompt', async () => {
    h.agencyFeatures = 1;
    h.whiteLabel = { isLoading: false, isError: true, error: PLAN_403, data: undefined };
    wrap(<WhiteLabelTab websiteId="w1" />);
    expect(await screen.findByText('White label is part of the Agency plan')).toBeTruthy();
  });

  it('Client access: the prompt instead of the panel', () => {
    wrap(<ClientPortalPanel websiteId="w1" client={demoAgencyClients()[0]!} />);
    expect(screen.getByText('Client access is part of the Agency plan')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generate link/ })).toBeNull();
  });

  it('Client access: a 403 AGENCY_PLAN_REQUIRED from generating a link brings up the prompt', async () => {
    h.agencyFeatures = 1;
    h.mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) => opts.onError(PLAN_403));
    wrap(<ClientPortalPanel websiteId="w1" client={demoAgencyClients()[0]!} />);
    fireEvent.click(screen.getByRole('button', { name: /Generate link/ }));
    expect(await screen.findByText('Client access is part of the Agency plan')).toBeTruthy();
  });
});

describe('isAgencyPlanRequired', () => {
  it('matches only a 403 with the AGENCY_PLAN_REQUIRED code', () => {
    expect(isAgencyPlanRequired({ response: { status: 403, data: { error: 'AGENCY_PLAN_REQUIRED', resource: 'clients' } } })).toBe(true);
    expect(isAgencyPlanRequired({ response: { status: 403, data: { error: 'forbidden' } } })).toBe(false);
    expect(isAgencyPlanRequired({ response: { status: 400, data: { error: 'AGENCY_PLAN_REQUIRED' } } })).toBe(false);
    expect(isAgencyPlanRequired(new Error('x'))).toBe(false);
  });
});
