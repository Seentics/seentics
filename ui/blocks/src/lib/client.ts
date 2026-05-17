export interface SeenticsClientOptions {
  apiKey:  string;
  baseUrl: string;
}

export type SeenticsClient = ReturnType<typeof createClient>;

export function createClient({ apiKey, baseUrl }: SeenticsClientOptions) {
  const base    = baseUrl.replace(/\/$/, '');
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  async function get<T>(path: string, params?: Record<string, string | number | undefined | null>): Promise<T> {
    const url = new URL(base + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`Seentics API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    return res.json() as Promise<T>;
  }

  return {
    // Analytics
    getOverview:   (websiteId: string, days?: number) =>
      get<import('./types').OverviewData>('/api/v1/raw/analytics/overview', { website_id: websiteId, days }),

    getTimeseries: (websiteId: string, days?: number) =>
      get<import('./types').TimeseriesData>('/api/v1/raw/analytics/timeseries', { website_id: websiteId, days }),

    getTopPages:   (websiteId: string, days?: number) =>
      get<import('./types').TopPagesData>('/api/v1/raw/analytics/top-pages', { website_id: websiteId, days }),

    getSources:    (websiteId: string, days?: number) =>
      get<import('./types').SourcesData>('/api/v1/raw/analytics/sources', { website_id: websiteId, days }),

    getEvents:     (websiteId: string, days?: number) =>
      get<import('./types').EventsData>('/api/v1/raw/analytics/events', { website_id: websiteId, days }),

    getRealtime:   (websiteId: string) =>
      get<import('./types').RealtimeData>('/api/v1/raw/analytics/realtime', { website_id: websiteId }),

    // Funnels
    getFunnels:    (websiteId: string) =>
      get<{ funnels: import('./types').Funnel[] }>('/api/v1/raw/funnels', { website_id: websiteId }),

    getFunnel:     (websiteId: string, funnelId: string) =>
      get<import('./types').Funnel>(`/api/v1/raw/funnels/${funnelId}`, { website_id: websiteId }),

    // Heatmaps
    getHeatmapPages: (websiteId: string) =>
      get<{ pages: import('./types').HeatmapPageSummary[] }>('/api/v1/raw/heatmaps/list', { website_id: websiteId }),

    getHeatmapData:  (websiteId: string, pagePath: string, eventType: 'click' | 'scroll' = 'click') =>
      get<import('./types').HeatmapData>('/api/v1/raw/heatmaps/clicks', { website_id: websiteId, page_path: pagePath, event_type: eventType }),

    // Replays
    getReplays:    (websiteId: string, limit?: number, offset?: number) =>
      get<{ sessions: import('./types').ReplaySession[] }>('/api/v1/raw/replays', { website_id: websiteId, limit, offset }),

    getReplay:     (websiteId: string, sessionId: string) =>
      get<{ meta: import('./types').ReplaySession; chunks: Array<{ sequence: number; data: import('./types').RRWebEvent[] }> }>(
        `/api/v1/raw/replays/${sessionId}`,
        { website_id: websiteId },
      ),
  };
}
