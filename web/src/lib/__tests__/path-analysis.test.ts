import { describe, expect, it } from 'vitest';
import { pathAnalysisFrom } from '@/features/analytics/path-analysis';

describe('pathAnalysisFrom', () => {
  const paths = {
    paths: [
      { page_1: '/', page_2: '/docs', page_3: '/apply', sessions: 3 },
      { page_1: '/', page_2: '/catalog', page_3: '/checkout', sessions: 1 },
      { page_1: '/broken', page_2: null, page_3: null, sessions: 2 },
    ],
  };
  const insights = {
    visitor_insights: {
      top_entry_pages: [{ page: '/', sessions: 4 }, { page: '/broken', sessions: 2 }],
      top_exit_pages: [{ page: '/apply', sessions: 3 }],
    },
  };

  it('takes entry and exit pages from visitor insights', () => {
    const model = pathAnalysisFrom(paths, insights);
    expect(model.top_entry_pages).toEqual([{ name: '/', count: 4 }, { name: '/broken', count: 2 }]);
    expect(model.top_exit_pages).toEqual([{ name: '/apply', count: 3 }]);
  });

  it('builds flows from consecutive steps, weighted by sessions, most taken first', () => {
    const model = pathAnalysisFrom(paths, insights);
    expect(model.page_flows[0]).toEqual({ from_page: '/', to_page: '/docs', count: 3 });
    expect(model.page_flows).toContainEqual({ from_page: '/catalog', to_page: '/checkout', count: 1 });
    // A single-page session has no transition.
    expect(model.page_flows.some(f => f.from_page === '/broken')).toBe(false);
  });

  it('names the most common journey', () => {
    expect(pathAnalysisFrom(paths, insights).top_journey).toBe('/ → /docs → /apply');
  });

  it('is empty rather than invented when there is no data', () => {
    expect(pathAnalysisFrom({}, {})).toEqual({ top_entry_pages: [], top_exit_pages: [], page_flows: [], top_journey: null });
  });
});
