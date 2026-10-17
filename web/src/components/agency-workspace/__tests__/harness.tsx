import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

/**
 * The agency API over a mocked axios instance: tests register answers per `METHOD /path`
 * (query string ignored) and read back what was sent. The real `features/agency/api.ts` and
 * queries run on top, so the paths, bodies and headers under test are the ones shipped.
 */

export type Sent = { method: string; url: string; params?: Record<string, unknown>; data?: unknown; headers?: Record<string, string> };
type Answer = ((req: Sent) => unknown) | Record<string, unknown> | string | null;

export const apiState = {
  routes: new Map<string, Answer>(),
  sent: [] as Sent[],
};

export class HttpError extends Error {
  response: { status: number; data: unknown };
  constructor(status: number, code: string, message = code) {
    super(message);
    this.response = { status, data: { error: { code, message, request_id: 'req_test' } } };
  }
}

export function route(method: string, url: string, answer: Answer) {
  apiState.routes.set(`${method} ${url}`, answer);
}

export function resetApi() {
  apiState.routes.clear();
  apiState.sent.length = 0;
}

export const sentTo = (method: string, url: string) => apiState.sent.filter(s => s.method === method && s.url === url);

export const mockRequest = vi.fn(async (config: Sent) => {
  const req: Sent = { ...config, method: config.method.toUpperCase() };
  apiState.sent.push(req);
  const answer = apiState.routes.get(`${req.method} ${req.url}`);
  if (answer === undefined) throw new HttpError(404, 'not_found', `No mock for ${req.method} ${req.url}`);
  const value = typeof answer === 'function' ? (answer as (r: Sent) => unknown)(req) : answer;
  if (value instanceof Error) throw value;
  return { data: value };
});

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

export const list = <T,>(data: T[], next: string | null = null) => ({ data, page: { next_cursor: next, has_more: next !== null } });

export const counts = (events: number, recordings = 0, leads = 0, ai = 0) => ({ events, recordings, leads, ai_analyses: ai });

export const CLIENT = {
  id: 'c1', name: 'Acme Bakery', company: 'Acme Ltd', notes: '', status: 'active' as const, website_count: 1,
  collect_features: { analytics: true, heatmaps: true, replays: true, funnels: true, automations: true, errors: true },
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

export const SITE = {
  id: 'w1', client_id: 'c1' as string | null, name: 'Acme site', url: 'https://acme.test', tracking_id: 'ST-1',
  is_active: true, is_verified: false, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

const step = (summary: string) => ({ summary, docs_url: `https://seentics.com/docs/${summary.split(' ')[0]}` });

export const INSTALL = {
  website_id: 'w1', tracking_id: 'ST-1', script_url: 'https://seentics.com/t.js',
  snippet_html: '<script defer data-website-id="w1" src="https://seentics.com/t.js"></script>',
  instructions: {
    html: step('html steps'), gtm: step('gtm steps'), nextjs: step('next steps'),
    wordpress: step('wp steps'), shopify: step('shopify steps'), npm: step('npm steps'),
  },
  verification: { status: 'not_seen' as const, is_verified: false, last_event_at: null as string | null, events_24h: 0 },
};
