import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  demoAgencyClients, demoAgencyKeys, demoClientUsers, demoCustomDomain, demoEmbedLinks, demoMutationGuard, demoWhiteLabel, isDemo,
} from '@/lib/demo';
import {
  assignWebsite,
  createAgencyAPIKey,
  createClient,
  createEmbedLink,
  deleteAgencyAPIKey,
  deleteClient,
  getClient,
  getCustomDomain,
  getWhiteLabel,
  listAgencyAPIKeys,
  listClientUsers,
  listClients,
  listEmbedLinks,
  revokeEmbedLink,
  updateEmbedLinkSections,
  unassignWebsite,
  updateClient,
} from './api';
import type { AccountScope, AgencyClient, CustomDomain, CreateClientRequest, EmbedSection, UpdateClientRequest } from './types';

/**
 * Agency data is account-wide, but the page is reached under a website, and on the demo
 * website every read comes from fixtures and every write is refused with the usual demo
 * notice — the same contract as the rest of the dashboard (`lib/demo`).
 */

export const agencyKeys = {
  clients: ['agency-clients'] as const,
  client: (id: string) => ['agency-client', id] as const,
  apiKeys: ['agency-api-keys'] as const,
  embedLinks: ['agency-embed-links'] as const,
  clientUsers: ['agency-client-users'] as const,
  whiteLabel: ['agency-white-label'] as const,
  customDomain: ['agency-custom-domain'] as const,
};

export function useAgencyClients(websiteId: string) {
  return useQuery({
    queryKey: [...agencyKeys.clients, isDemo(websiteId)],
    queryFn: () => (isDemo(websiteId) ? demoAgencyClients() : listClients()),
    enabled: !!websiteId,
  });
}

export function useAgencyClient(websiteId: string, clientId: string) {
  return useQuery({
    queryKey: [...agencyKeys.client(clientId), isDemo(websiteId)],
    queryFn: async (): Promise<AgencyClient> => {
      if (!isDemo(websiteId)) return getClient(clientId);
      const found = demoAgencyClients().find(c => c.id === clientId);
      if (!found) throw new Error('not found');
      return found;
    },
    enabled: !!websiteId && !!clientId,
  });
}

export function useAgencyAPIKeys(websiteId: string) {
  return useQuery({
    queryKey: [...agencyKeys.apiKeys, isDemo(websiteId)],
    queryFn: () => (isDemo(websiteId) ? demoAgencyKeys() : listAgencyAPIKeys()),
    enabled: !!websiteId,
  });
}

export function useEmbedLinks(websiteId: string) {
  return useQuery({
    queryKey: [...agencyKeys.embedLinks, isDemo(websiteId)],
    queryFn: () => (isDemo(websiteId) ? demoEmbedLinks() : listEmbedLinks()),
    enabled: !!websiteId,
  });
}

// Client access, white label and the custom domain take the Agency plan for every call, so each
// read is `enabled` only where the caller has it (`useAgencyPlan`).

export function useClientUsers(websiteId: string, opts: { clientId?: string; enabled: boolean }) {
  return useQuery({
    queryKey: [...agencyKeys.clientUsers, opts.clientId ?? 'all', isDemo(websiteId)],
    queryFn: async () => {
      if (!isDemo(websiteId)) return listClientUsers(opts.clientId);
      return demoClientUsers().filter(u => !opts.clientId || u.clientId === opts.clientId);
    },
    enabled: !!websiteId && opts.enabled,
  });
}

export function useWhiteLabel(websiteId: string, opts: { enabled: boolean }) {
  return useQuery({
    queryKey: [...agencyKeys.whiteLabel, isDemo(websiteId)],
    queryFn: () => (isDemo(websiteId) ? demoWhiteLabel() : getWhiteLabel()),
    enabled: !!websiteId && opts.enabled,
  });
}

/** How often a domain still being set up is asked about: DNS and certificates take minutes. */
export const CUSTOM_DOMAIN_POLL_MS = 15_000;

export const isDomainPending = (d: CustomDomain | null | undefined) =>
  d?.state === 'pending_dns' || d?.state === 'pending_certificate';

/** The agency's portal domain, `null` when it has none; polled while it is being set up. */
export function useCustomDomain(websiteId: string, opts: { enabled: boolean }) {
  return useQuery({
    queryKey: [...agencyKeys.customDomain, isDemo(websiteId)],
    queryFn: () => (isDemo(websiteId) ? demoCustomDomain() : getCustomDomain()),
    enabled: !!websiteId && opts.enabled,
    refetchInterval: (query) => (isDomainPending(query.state.data) ? CUSTOM_DOMAIN_POLL_MS : false),
  });
}

/** Throws a quiet marker in demo mode, so callers' onError can tell it from a real failure. */
class DemoRefused extends Error {}
export const isDemoRefusal = (e: unknown) => e instanceof DemoRefused;

function guard(websiteId: string) {
  if (demoMutationGuard(websiteId)) throw new DemoRefused('demo');
}

export function useAgencyMutation<V, R>(websiteId: string, fn: (v: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      guard(websiteId);
      return fn(v);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agencyKeys.clients });
      queryClient.invalidateQueries({ queryKey: agencyKeys.embedLinks });
      queryClient.invalidateQueries({ queryKey: ['agency-client'] });
      queryClient.invalidateQueries({ queryKey: agencyKeys.apiKeys });
      queryClient.invalidateQueries({ queryKey: agencyKeys.clientUsers });
    },
  });
}

export const useCreateClient = (websiteId: string) =>
  useAgencyMutation(websiteId, (req: CreateClientRequest) => createClient(req));

export const useUpdateClient = (websiteId: string) =>
  useAgencyMutation(websiteId, ({ id, req }: { id: string; req: UpdateClientRequest }) => updateClient(id, req));

export const useDeleteClient = (websiteId: string) =>
  useAgencyMutation(websiteId, (id: string) => deleteClient(id));

export const useAssignWebsite = (websiteId: string) =>
  useAgencyMutation(websiteId, ({ clientId, siteId }: { clientId: string; siteId: string }) => assignWebsite(clientId, siteId));

export const useUnassignWebsite = (websiteId: string) =>
  useAgencyMutation(websiteId, ({ clientId, siteId }: { clientId: string; siteId: string }) => unassignWebsite(clientId, siteId));

export const useCreateAPIKey = (websiteId: string) =>
  useAgencyMutation(websiteId, ({ name, scopes }: { name: string; scopes: AccountScope[] }) => createAgencyAPIKey(name, scopes));

export const useCreateEmbedLink = (websiteId: string) =>
  useAgencyMutation(
    websiteId,
    ({ target, sections }: { target: { websiteId: string } | { clientId: string }; sections?: EmbedSection[] }) =>
      createEmbedLink(target, sections),
  );

export const useUpdateEmbedLink = (websiteId: string) =>
  useAgencyMutation(websiteId, ({ id, sections }: { id: string; sections: EmbedSection[] }) =>
    updateEmbedLinkSections(id, sections));

export const useRevokeEmbedLink = (websiteId: string) =>
  useAgencyMutation(websiteId, (id: string) => revokeEmbedLink(id));

export const useDeleteAPIKey = (websiteId: string) =>
  useAgencyMutation(websiteId, (id: string) => deleteAgencyAPIKey(id));
