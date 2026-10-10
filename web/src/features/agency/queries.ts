import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { demoAgencyClients, demoAgencyKeys, demoEmbedLinks, demoMutationGuard, isDemo } from '@/lib/demo';
import {
  assignWebsite,
  createAgencyAPIKey,
  createClient,
  createEmbedLink,
  deleteAgencyAPIKey,
  deleteClient,
  getClient,
  listAgencyAPIKeys,
  listClients,
  listEmbedLinks,
  revokeEmbedLink,
  updateEmbedLinkSections,
  unassignWebsite,
  updateClient,
} from './api';
import type { AccountScope, AgencyClient, CreateClientRequest, EmbedSection, UpdateClientRequest } from './types';

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

/** Throws a quiet marker in demo mode, so callers' onError can tell it from a real failure. */
class DemoRefused extends Error {}
export const isDemoRefusal = (e: unknown) => e instanceof DemoRefused;

function guard(websiteId: string) {
  if (demoMutationGuard(websiteId)) throw new DemoRefused('demo');
}

function useAgencyMutation<V, R>(websiteId: string, fn: (v: V) => Promise<R>) {
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
