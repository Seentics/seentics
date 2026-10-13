/**
 * Endpoint functions for the integrations feature. No React, no hooks — just transport.
 *
 * The demo site has no integrations to show, so it answers with the provider list unconnected
 * and refuses to connect: a demo visitor must never be able to type a real API key into a
 * public page.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import type { ConnectInput, Connection, Delivery, Provider, TestOutcome, UpdateInput } from './types';

/** The API's own words for what went wrong, so the dialog can show them. */
export class IntegrationApiError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

function toError(err: unknown): IntegrationApiError {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return new IntegrationApiError(data?.message ?? 'Something went wrong. Please try again.', data?.error ?? 'unknown');
}

export const integrationsApi = {
  async list(websiteId: string): Promise<Provider[]> {
    if (isDemo(websiteId)) return [];
    const res = await api.get(`/integrations/${websiteId}`);
    return res.data?.data?.providers ?? [];
  },

  async deliveries(websiteId: string, limit = 25): Promise<Delivery[]> {
    if (isDemo(websiteId)) return [];
    const res = await api.get(`/integrations/${websiteId}/deliveries`, { params: { limit } });
    return res.data?.data?.deliveries ?? [];
  },

  async connect(websiteId: string, provider: string, input: ConnectInput): Promise<Connection | null> {
    if (demoMutationGuard(websiteId)) return null;
    try {
      return (await api.put(`/integrations/${websiteId}/${provider}`, input)).data?.data ?? null;
    } catch (err) {
      throw toError(err);
    }
  },

  async update(websiteId: string, provider: string, input: UpdateInput): Promise<Connection | null> {
    if (demoMutationGuard(websiteId)) return null;
    try {
      return (await api.patch(`/integrations/${websiteId}/${provider}`, input)).data?.data ?? null;
    } catch (err) {
      throw toError(err);
    }
  },

  async disconnect(websiteId: string, provider: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    try {
      await api.delete(`/integrations/${websiteId}/${provider}`);
    } catch (err) {
      throw toError(err);
    }
  },

  async sendTest(websiteId: string, provider: string): Promise<TestOutcome> {
    if (demoMutationGuard(websiteId)) return { kind: 'skipped', reason: 'Not available in the demo' };
    try {
      return (await api.post(`/integrations/${websiteId}/${provider}/test`)).data?.data as TestOutcome;
    } catch (err) {
      throw toError(err);
    }
  },
};
