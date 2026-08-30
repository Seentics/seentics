import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

/**
 * The six KPI tiles at the top of every dashboard.
 *
 * The component's real logic is not layout — it is which of three overlapping copies of
 * each KPI to believe, and how to describe a change against a prior period that may have
 * been empty. Both are places where a plausible edit produces a number that is wrong but
 * not obviously wrong, so they are asserted against rendered text rather than props.
 */

const useLiveVisitors = vi.hoisted(() => vi.fn(() => ({ data: 0 })));

vi.mock('@/lib/analytics-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics-api')>()),
  useLiveVisitors,
}));

import { SummaryCards } from '@/components/analytics/SummaryCards';

/** A dashboard payload with the three-way mirroring the API really emits. */
function dashboard(over: Record<string, unknown> = {}) {
  return {
    website_id: 'site_1',
    date_range: '7d',
    total_visitors: 120,
    unique_visitors: 120,
    sessions: 200,
    live_visitors: 5,
    page_views: 500,
    session_duration: 184,
    bounce_rate: 42.5,
    metrics: {
      page_views: 500,
      unique_visitors: 120,
      sessions: 200,
      bounce_rate: 42.5,
      avg_session_time: 184,
    },
    comparison: {
      current_period: {
        total_visitors: 120,
        unique_visitors: 120,
        page_views: 500,
        sessions: 200,
        bounce_rate: 42.5,
        avg_session_time: 184,
      },
      previous_period: {
        total_visitors: 100,
        unique_visitors: 100,
        page_views: 400,
        sessions: 160,
        bounce_rate: 50,
        avg_session_time: 200,
      },
    },
    ...over,
  };
}

/** The tile whose label matches, as a queryable scope. */
function tile(label: string): HTMLElement {
  const heading = screen.getByText(label);
  const card = heading.closest('div.group');
  if (!card) throw new Error(`no tile found for "${label}"`);
  return card as HTMLElement;
}

beforeEach(() => {
  useLiveVisitors.mockReturnValue({ data: 0 } as never);
});

describe('SummaryCards', () => {
  it('renders all six KPI tiles', () => {
    render(<SummaryCards data={dashboard()} websiteId="site_1" />);
    for (const label of [
      'Live Visitors',
      'Unique Visitors',
      'Total visitors',
      'Page Views',
      'Session Duration',
      'Bounce Rate',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders skeletons while loading and no numbers', () => {
    const { container } = render(<SummaryCards data={undefined} isLoading websiteId="site_1" />);
    expect(screen.queryByText('Unique Visitors')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders skeletons when data is absent even without the loading flag', () => {
    // A failed query leaves `data` undefined; rendering zeroes would claim the site
    // had no traffic rather than that the read failed.
    render(<SummaryCards data={undefined} websiteId="site_1" />);
    expect(screen.queryByText('Unique Visitors')).not.toBeInTheDocument();
  });

  // ─── Which copy of each KPI wins ──────────────────────────────────────────

  describe('field precedence', () => {
    it('prefers comparison.current_period over the top-level mirror', () => {
      // The big number and its growth badge have to describe the same window. Reading
      // the top-level field while the badge reads the comparison block is how a tile
      // ends up showing 500 views with a "0%" change against a prior period of 500.
      render(
        <SummaryCards
          websiteId="site_1"
          data={dashboard({
            page_views: 999,
            comparison: {
              current_period: { page_views: 500, sessions: 200, unique_visitors: 120, bounce_rate: 42.5, avg_session_time: 184 },
              previous_period: { page_views: 400 },
            },
          })}
        />,
      );
      expect(within(tile('Page Views')).getByText('500')).toBeInTheDocument();
    });

    it('falls back to the top-level field when there is no comparison block', () => {
      render(
        <SummaryCards websiteId="site_1" data={dashboard({ comparison: undefined, page_views: 777 })} />,
      );
      expect(within(tile('Page Views')).getByText('777')).toBeInTheDocument();
    });

    it('falls back to metrics when neither the comparison nor the top-level field is set', () => {
      render(
        <SummaryCards
          websiteId="site_1"
          data={{ ...dashboard(), comparison: undefined, sessions: undefined, metrics: { sessions: 321 } }}
        />,
      );
      expect(within(tile('Total visitors')).getByText('321')).toBeInTheDocument();
    });

    it('reports "Total visitors" as the session count, not a second copy of uniques', () => {
      // Product language: a "visit" is a session. Rendering unique visitors here would
      // put the same number in two adjacent tiles under different names.
      render(<SummaryCards websiteId="site_1" data={dashboard()} />);
      expect(within(tile('Total visitors')).getByText('200')).toBeInTheDocument();
      expect(within(tile('Unique Visitors')).getByText('120')).toBeInTheDocument();
    });

    it('formats large counts with thousands separators', () => {
      render(
        <SummaryCards
          websiteId="site_1"
          data={dashboard({ comparison: undefined, page_views: 1_234_567 })}
        />,
      );
      expect(within(tile('Page Views')).getByText('1,234,567')).toBeInTheDocument();
    });

    it('formats the session duration and bounce rate rather than printing raw numbers', () => {
      render(<SummaryCards websiteId="site_1" data={dashboard()} />);
      expect(within(tile('Session Duration')).getByText('3m 4s')).toBeInTheDocument();
      expect(within(tile('Bounce Rate')).getByText('42.5%')).toBeInTheDocument();
    });
  });

  // ─── Live visitors ────────────────────────────────────────────────────────

  describe('live visitors', () => {
    it('reads the live count from its own polling hook, not the dashboard payload', () => {
      // The dashboard read is 30 seconds stale; the badge has its own faster query.
      useLiveVisitors.mockReturnValue({ data: 42 } as never);
      render(<SummaryCards websiteId="site_1" data={dashboard({ live_visitors: 5 })} />);
      expect(within(tile('Live Visitors')).getByText('42')).toBeInTheDocument();
    });

    it('uses the payload value in demo mode, where there is no live query', () => {
      useLiveVisitors.mockReturnValue({ data: undefined } as never);
      render(<SummaryCards websiteId="demo" isDemo data={dashboard({ live_visitors: 17 })} />);
      expect(within(tile('Live Visitors')).getByText('17')).toBeInTheDocument();
    });

    it('shows zero rather than blank while the live query is still pending', () => {
      useLiveVisitors.mockReturnValue({ data: undefined } as never);
      render(<SummaryCards websiteId="site_1" data={dashboard()} />);
      expect(within(tile('Live Visitors')).getByText('0')).toBeInTheDocument();
    });

    it('carries no growth badge — a live count has no prior period', () => {
      useLiveVisitors.mockReturnValue({ data: 42 } as never);
      render(<SummaryCards websiteId="site_1" data={dashboard()} />);
      const live = tile('Live Visitors');
      expect(within(live).queryByText(/%$/)).not.toBeInTheDocument();
      expect(within(live).queryByText('New')).not.toBeInTheDocument();
    });
  });

  // ─── The growth badge ─────────────────────────────────────────────────────

  describe('growth badge', () => {
    function renderWithPrevious(previous: Record<string, unknown>) {
      render(
        <SummaryCards
          websiteId="site_1"
          data={dashboard({
            comparison: {
              current_period: { page_views: 500, sessions: 200, unique_visitors: 120, bounce_rate: 40, avg_session_time: 184 },
              previous_period: previous,
            },
          })}
        />,
      );
    }

    it('shows the percentage change against the prior period', () => {
      renderWithPrevious({ page_views: 400 });
      expect(within(tile('Page Views')).getByText('25.0%')).toBeInTheDocument();
    });

    it('shows the magnitude without a sign — direction is the arrow icon', () => {
      renderWithPrevious({ page_views: 1000 });
      expect(within(tile('Page Views')).getByText('50.0%')).toBeInTheDocument();
      expect(within(tile('Page Views')).queryByText('-50.0%')).not.toBeInTheDocument();
    });

    it('shows "New" rather than an infinite percentage when the prior period was empty', () => {
      // 500 from 0 is undefined growth, not 0% and not Infinity%.
      renderWithPrevious({ page_views: 0 });
      expect(within(tile('Page Views')).getByText('New')).toBeInTheDocument();
    });

    it('shows a dash when both periods were empty', () => {
      render(
        <SummaryCards
          websiteId="site_1"
          data={dashboard({
            comparison: {
              current_period: { page_views: 0, sessions: 0, unique_visitors: 0, bounce_rate: 0, avg_session_time: 0 },
              previous_period: { page_views: 0 },
            },
          })}
        />,
      );
      expect(within(tile('Page Views')).getByText('—')).toBeInTheDocument();
    });

    it('shows "No change" rather than 0.0% when the periods match', () => {
      renderWithPrevious({ page_views: 500 });
      expect(within(tile('Page Views')).getByText('No change')).toBeInTheDocument();
    });

    it('clamps runaway growth to 999+ instead of rendering six digits', () => {
      renderWithPrevious({ page_views: 1 });
      expect(within(tile('Page Views')).getByText('999+%')).toBeInTheDocument();
    });

    it('floors a total collapse at 100%', () => {
      render(
        <SummaryCards
          websiteId="site_1"
          data={dashboard({
            comparison: {
              current_period: { page_views: 0, sessions: 200, unique_visitors: 120, bounce_rate: 40, avg_session_time: 184 },
              previous_period: { page_views: 900 },
            },
          })}
        />,
      );
      expect(within(tile('Page Views')).getByText('100.0%')).toBeInTheDocument();
    });

    it('treats a falling bounce rate as an improvement', () => {
      // Bounce rate is inverted: down is good. Painting it red would tell the user
      // their best week was their worst.
      renderWithPrevious({ bounce_rate: 50 });
      const badge = within(tile('Bounce Rate')).getByText('20.0%').closest('span')!;
      expect(badge.className).toContain('emerald');
    });

    it('treats a rising bounce rate as a regression', () => {
      renderWithPrevious({ bounce_rate: 30 });
      const badge = within(tile('Bounce Rate')).getByText(/33\.3%/).closest('span')!;
      expect(badge.className).toContain('rose');
    });

    it('treats rising pageviews as an improvement', () => {
      renderWithPrevious({ page_views: 400 });
      const badge = within(tile('Page Views')).getByText('25.0%').closest('span')!;
      expect(badge.className).toContain('emerald');
    });

    it('omits the badge entirely when the prior period is absent', () => {
      render(<SummaryCards websiteId="site_1" data={dashboard({ comparison: undefined })} />);
      const views = tile('Page Views');
      expect(within(views).queryByText('New')).not.toBeInTheDocument();
      expect(within(views).queryByText('No change')).not.toBeInTheDocument();
    });
  });

  // ─── Visitor insights ─────────────────────────────────────────────────────

  describe('visitor insights', () => {
    it('renders without them — they are an optional enrichment', () => {
      expect(() =>
        render(<SummaryCards websiteId="site_1" data={dashboard()} visitorInsights={undefined} />),
      ).not.toThrow();
    });

    it('does not divide by zero when both new and returning are zero', () => {
      render(
        <SummaryCards
          websiteId="site_1"
          data={dashboard()}
          visitorInsights={{ visitor_insights: { new_visitors: 0, returning_visitors: 0 } }}
        />,
      );
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });
  });
});
