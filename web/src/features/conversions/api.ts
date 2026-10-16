/**
 * Endpoint functions for Conversions. No React, no hooks — just transport. The demo site answers
 * from `lib/demo/conversions`.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoConversionEvents, demoConversionSummary, demoDestinations } from '@/lib/demo/conversions';
import type {
  ConversionEventFilters, ConversionEventPage, ConversionSummary, Destination, DestinationInput, DestinationPatch, TestResult,
} from './types';

/**
 * Why connecting a platform was refused, with what to show. `invalid_credentials` carries the
 * platform's own message ("Invalid OAuth access token"), which the person can act on.
 */
export class ConnectError extends Error {
  constructor(readonly reason: 'invalid_credentials' | 'limit' | 'exists', message: string) {
    super(message);
  }
}

const base = (websiteId: string) => `/conversions/${websiteId}`;

/** Drop empty filters, so the query string carries only what narrows the list. */
const params = (filters: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined));

/**
 * 400/403/409 are answers when saving a destination, not failures: the shared client turns an
 * error response into a plain Error and drops its body, which carries the platform's message.
 */
const keepAnswers = { validateStatus: (s: number) => (s >= 200 && s < 300) || s === 400 || s === 403 || s === 409 };

function refusal(status: number, data: { error?: string; message?: string } | undefined): ConnectError | null {
  if (status === 409) return new ConnectError('exists', 'This account is already connected to this website.');
  if (status === 403 && data?.error === 'LIMIT_REACHED') {
    return new ConnectError('limit', 'Your plan has reached its number of connected platforms.');
  }
  if (status === 400 && data?.error === 'invalid_credentials') {
    return new ConnectError('invalid_credentials', data.message || 'The platform rejected these credentials.');
  }
  if (status >= 400) return new ConnectError('invalid_credentials', data?.message || data?.error || 'Could not save. Please try again.');
  return null;
}

export const conversionsApi = {
  async destinations(websiteId: string): Promise<Destination[]> {
    if (isDemo(websiteId)) return demoDestinations();
    const res = await api.get(`${base(websiteId)}/destinations`);
    return res.data?.data ?? [];
  },

  async connect(websiteId: string, input: DestinationInput): Promise<Destination | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.post(`${base(websiteId)}/destinations`, input, keepAnswers);
    const refused = refusal(res.status, res.data);
    if (refused) throw refused;
    return res.data?.data ?? null;
  },

  async update(websiteId: string, id: string, patch: DestinationPatch): Promise<Destination | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.patch(`${base(websiteId)}/destinations/${id}`, patch, keepAnswers);
    const refused = refusal(res.status, res.data);
    if (refused) throw refused;
    return res.data?.data ?? null;
  },

  async remove(websiteId: string, id: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`${base(websiteId)}/destinations/${id}`);
  },

  async test(websiteId: string, id: string, testEventCode?: string): Promise<TestResult> {
    if (isDemo(websiteId)) {
      return { ok: true, message: 'Demo: a test Purchase would be sent now. On your own site it shows in the platform within a minute.' };
    }
    const res = await api.post(`${base(websiteId)}/destinations/${id}/test`, testEventCode ? { test_event_code: testEventCode } : {});
    return res.data?.data ?? { ok: false, message: 'No answer from the platform.' };
  },

  async events(websiteId: string, filters: ConversionEventFilters): Promise<ConversionEventPage> {
    if (isDemo(websiteId)) return demoConversionEvents(filters);
    const res = await api.get(`${base(websiteId)}/events`, { params: params(filters) });
    return { events: res.data?.data?.events ?? [], total: res.data?.data?.total ?? 0 };
  },

  async retry(websiteId: string, eventId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.post(`${base(websiteId)}/events/${eventId}/retry`);
  },

  async summary(websiteId: string, days: number): Promise<ConversionSummary | null> {
    if (isDemo(websiteId)) return demoConversionSummary(days);
    const res = await api.get(`${base(websiteId)}/summary`, { params: { days } });
    return res.data?.data ?? null;
  },
};
