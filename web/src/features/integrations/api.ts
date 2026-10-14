/**
 * Endpoint functions for the integrations feature (destinations). No React, no hooks — just transport.
 *
 * The demo site answers from `lib/demo/integrations` — three destinations, two of them webhooks,
 * with a delivery log showing every state — and refuses every change: a demo visitor's
 * credentials are never sent anywhere.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoDeliveries, demoOverview } from '@/lib/demo/integrations';
import type {
  Connection, CreateInput, Delivery, DeliveryFilters, IntegrationOverview, TestOutcome, UpdateInput,
} from './types';

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
  async overview(websiteId: string): Promise<IntegrationOverview> {
    if (isDemo(websiteId)) return demoOverview();
    const res = await api.get(`/integrations/${websiteId}`);
    return { providers: res.data?.data?.providers ?? [], connections: res.data?.data?.connections ?? [] };
  },

  async deliveries(websiteId: string, filters: DeliveryFilters = {}): Promise<Delivery[]> {
    if (isDemo(websiteId)) return demoDeliveries(filters);
    const res = await api.get(`/integrations/${websiteId}/deliveries`, { params: { limit: 25, ...filters } });
    return res.data?.data?.deliveries ?? [];
  },

  async create(websiteId: string, input: CreateInput): Promise<Connection | null> {
    if (demoMutationGuard(websiteId)) return null;
    try {
      return (await api.post(`/integrations/${websiteId}/connections`, input)).data?.data ?? null;
    } catch (err) {
      throw toError(err);
    }
  },

  async update(websiteId: string, connectionId: string, input: UpdateInput): Promise<Connection | null> {
    if (demoMutationGuard(websiteId)) return null;
    try {
      return (await api.patch(`/integrations/${websiteId}/connections/${connectionId}`, input)).data?.data ?? null;
    } catch (err) {
      throw toError(err);
    }
  },

  async remove(websiteId: string, connectionId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    try {
      await api.delete(`/integrations/${websiteId}/connections/${connectionId}`);
    } catch (err) {
      throw toError(err);
    }
  },

  async sendTest(websiteId: string, connectionId: string): Promise<TestOutcome> {
    if (demoMutationGuard(websiteId)) return { kind: 'skipped', reason: 'Not available in the demo' };
    try {
      return (await api.post(`/integrations/${websiteId}/connections/${connectionId}/test`)).data?.data as TestOutcome;
    } catch (err) {
      throw toError(err);
    }
  },

  /** Put a failed delivery back in the queue. */
  async retryDelivery(websiteId: string, deliveryId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    try {
      await api.post(`/integrations/${websiteId}/deliveries/${deliveryId}/retry`);
    } catch (err) {
      throw toError(err);
    }
  },
};
