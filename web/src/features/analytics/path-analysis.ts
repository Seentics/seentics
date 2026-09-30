/**
 * The Paths page's model, assembled from the two endpoints that hold the facts.
 *
 * The page used to read `top_entry_pages`, `top_exit_pages` and `page_flows` straight off
 * `/analytics/path-analysis` — fields that endpoint has never returned (it returns each
 * session's first three pages as `paths`), so every section was permanently empty, and
 * the headline numbers above it were hard-coded sample values shown for every site.
 *
 * Entry and exit pages come from visitor insights, which computes them over whole
 * sessions. Flows and the top journey come from the paths: the transitions between each
 * session's first three pages, weighted by how many sessions took them.
 */
export type PathsResponse = {
  paths?: { page_1: string; page_2: string | null; page_3: string | null; sessions: number }[];
};

export type InsightsResponse = {
  visitor_insights?: {
    top_entry_pages?: { page: string; sessions: number }[];
    top_exit_pages?: { page: string; sessions: number }[];
  };
};

export type PathAnalysisModel = {
  top_entry_pages: { name: string; count: number }[];
  top_exit_pages: { name: string; count: number }[];
  page_flows: { from_page: string; to_page: string; count: number }[];
  /** The most common journey, e.g. "/ → /pricing → /checkout"; null with no data. */
  top_journey: string | null;
};

const MAX_FLOWS = 20;

export function pathAnalysisFrom(paths: PathsResponse, insights: InsightsResponse): PathAnalysisModel {
  const rows = paths.paths ?? [];
  const flows = new Map<string, { from_page: string; to_page: string; count: number }>();
  for (const row of rows) {
    const steps = [row.page_1, row.page_2, row.page_3].filter((p): p is string => !!p);
    for (let i = 0; i + 1 < steps.length; i++) {
      const key = `${steps[i]}\0${steps[i + 1]}`;
      const flow = flows.get(key) ?? { from_page: steps[i], to_page: steps[i + 1], count: 0 };
      flow.count += row.sessions;
      flows.set(key, flow);
    }
  }
  const top = [...rows].sort((a, b) => b.sessions - a.sessions)[0];
  const vi = insights.visitor_insights ?? {};
  return {
    top_entry_pages: (vi.top_entry_pages ?? []).map(p => ({ name: p.page, count: p.sessions })),
    top_exit_pages: (vi.top_exit_pages ?? []).map(p => ({ name: p.page, count: p.sessions })),
    page_flows: [...flows.values()].sort((a, b) => b.count - a.count).slice(0, MAX_FLOWS),
    top_journey: top ? [top.page_1, top.page_2, top.page_3].filter(Boolean).join(' → ') : null,
  };
}
