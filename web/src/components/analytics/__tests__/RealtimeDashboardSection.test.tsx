import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

/**
 * The realtime page.
 *
 * The section composes four data surfaces, but the logic it owns is small and worth
 * pinning exactly: the pages-per-visitor tile it derives itself, the page labels and
 * flags in the two top-lists, and the refresh control that must not appear in demo
 * mode, where there is nothing to refetch. The geo map is stubbed — it loads a
 * dynamically-imported world map that has nothing to do with this component.
 */

const hooks = vi.hoisted(() => ({
  useRealtimeData: vi.fn(),
  useRecentActivity: vi.fn(),
  isDemo: vi.fn(() => false),
}));

vi.mock('@/lib/analytics-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics-api')>()),
  useRealtimeData: hooks.useRealtimeData,
  useRecentActivity: hooks.useRecentActivity,
}));

vi.mock('@/lib/demo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/demo')>()),
  isDemo: hooks.isDemo,
}));

vi.mock('@/components/analytics/RealtimeGeoMap', () => ({
  RealtimeGeoMap: () => <div data-testid="geo-map" />,
}));

// Recharts measures its container, which jsdom reports as 0×0 — the chart would render
// nothing and log a warning. The surrounding panel is what this file asserts on.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 400, height: 200 }}>{children}</div>
  ),
}));

import { RealtimeDashboardSection } from '@/components/analytics/RealtimeDashboardSection';

const SITE = 'ab12cd34';

function realtime(over: Record<string, unknown> = {}) {
  return {
    website_id: SITE,
    active_visitors: 40,
    live_visitors: 3,
    pageviews: 100,
    sessions: 55,
    top_pages: [{ page: '/pricing', visitors: 20 }],
    top_countries: [{ name: 'US', visitors: 15 }],
    top_referrers: [],
    top_devices: [],
    top_browsers: [],
    timeline: [{ minute: '11:59', views: 4, visitors: 2 }],
    ...over,
  };
}

function setup(over: { realtime?: Record<string, unknown> | undefined; loading?: boolean; demo?: boolean } = {}) {
  hooks.isDemo.mockReturnValue(over.demo ?? false);
  hooks.useRealtimeData.mockReturnValue({
    data: 'realtime' in over ? over.realtime : realtime(),
    isLoading: over.loading ?? false,
    isFetching: false,
    refetch: vi.fn(),
  });
  hooks.useRecentActivity.mockReturnValue({
    data: { activities: [] },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  });
  return render(<RealtimeDashboardSection websiteId={SITE} />);
}

/** The stat tile whose label matches. */
function statTile(label: string): HTMLElement {
  const el = screen.getByText(label);
  return el.closest('div')!.parentElement as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Page chrome ─────────────────────────────────────────────────────────────

describe('page chrome', () => {
  it('renders the page heading and every panel', () => {
    setup();
    expect(screen.getByText('Realtime')).toBeInTheDocument();
    expect(screen.getByText('Last 30 minutes')).toBeInTheDocument();
    expect(screen.getByText('Top pages')).toBeInTheDocument();
    expect(screen.getByText('Top countries')).toBeInTheDocument();
    expect(screen.getByText('Activity log')).toBeInTheDocument();
    expect(screen.getByTestId('geo-map')).toBeInTheDocument();
  });

  it('subscribes the activity feed to a 30-minute pageview window', () => {
    // The panel's own copy says "updates about every 12 seconds" over the last half
    // hour; the hook options are what actually make that true.
    setup();
    expect(hooks.useRecentActivity).toHaveBeenCalledWith(
      SITE,
      expect.objectContaining({ limit: 50, withinMinutes: 30 }),
    );
  });
});

// ─── Stat tiles ──────────────────────────────────────────────────────────────

describe('stat tiles', () => {
  it('renders the four headline figures from the realtime payload', () => {
    setup();
    expect(within(statTile('Active now')).getByText('40')).toBeInTheDocument();
    expect(within(statTile('Sessions')).getByText('55')).toBeInTheDocument();
    // "Pageviews" also labels the chart legend, so this one is found by its value.
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('derives pages per visitor to one decimal', () => {
    setup({ realtime: realtime({ pageviews: 100, active_visitors: 40 }) });
    expect(within(statTile('Pages / visitor')).getByText('2.5')).toBeInTheDocument();
  });

  it('rounds pages per visitor rather than truncating', () => {
    setup({ realtime: realtime({ pageviews: 10, active_visitors: 3 }) });
    expect(within(statTile('Pages / visitor')).getByText('3.3')).toBeInTheDocument();
  });

  it('shows 0.0 rather than Infinity when nobody is on the site', () => {
    setup({ realtime: realtime({ pageviews: 12, active_visitors: 0 }) });
    expect(within(statTile('Pages / visitor')).getByText('0.0')).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });

  it('divides by active visitors, not sessions — the tile says "per visitor"', () => {
    setup({ realtime: realtime({ pageviews: 100, active_visitors: 40, sessions: 50 }) });
    expect(within(statTile('Pages / visitor')).getByText('2.5')).toBeInTheDocument();
    expect(within(statTile('Pages / visitor')).queryByText('2.0')).not.toBeInTheDocument();
  });

  it('renders zeroes rather than blanks when the payload is missing', () => {
    setup({ realtime: undefined });
    expect(within(statTile('Active now')).getByText('0')).toBeInTheDocument();
    expect(within(statTile('Pages / visitor')).getByText('0.0')).toBeInTheDocument();
  });
});

// ─── Timeline chart ──────────────────────────────────────────────────────────

describe('timeline panel', () => {
  /** Scoped because "Pageviews" also labels a stat tile above the chart. */
  function timelinePanel(): HTMLElement {
    return screen.getByText('Last 30 minutes').closest('div.surface') as HTMLElement;
  }

  it('labels both series in the legend', () => {
    setup();
    expect(within(timelinePanel()).getByText('Pageviews')).toBeInTheDocument();
    expect(within(timelinePanel()).getByText('Visitors')).toBeInTheDocument();
  });

  it('shows an explicit empty message when every bucket is zero', () => {
    // A flat line at zero and a broken chart look identical; the message distinguishes
    // "no traffic" from "the chart failed to draw".
    setup({
      realtime: realtime({ timeline: [{ minute: '11:59', views: 0, visitors: 0 }] }),
    });
    expect(screen.getByText('No traffic in the last 30 minutes')).toBeInTheDocument();
  });

  it('shows the empty message when the timeline is absent entirely', () => {
    setup({ realtime: realtime({ timeline: undefined }) });
    expect(screen.getByText('No traffic in the last 30 minutes')).toBeInTheDocument();
  });

  it('draws the chart when any bucket has traffic', () => {
    setup({ realtime: realtime({ timeline: [{ minute: '11:59', views: 4, visitors: 2 }] }) });
    expect(screen.queryByText('No traffic in the last 30 minutes')).not.toBeInTheDocument();
  });

  it('renders a skeleton panel while loading rather than the empty message', () => {
    const { container } = setup({ loading: true, realtime: undefined });
    expect(screen.queryByText('No traffic in the last 30 minutes')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

// ─── Top lists ───────────────────────────────────────────────────────────────

describe('top pages', () => {
  function pagesPanel(): HTMLElement {
    return screen.getByText('Top pages').closest('div.surface') as HTMLElement;
  }

  it('renders a humanised label rather than the raw path', () => {
    setup({ realtime: realtime({ top_pages: [{ page: '/pricing', visitors: 20 }] }) });
    expect(within(pagesPanel()).getByText('Pricing')).toBeInTheDocument();
  });

  it('names the root path "Homepage"', () => {
    setup({ realtime: realtime({ top_pages: [{ page: '/', visitors: 9 }] }) });
    expect(within(pagesPanel()).getByText('Homepage')).toBeInTheDocument();
  });

  it('title-cases a hyphenated slug', () => {
    setup({ realtime: realtime({ top_pages: [{ page: '/getting-started', visitors: 4 }] }) });
    expect(within(pagesPanel()).getByText('Getting Started')).toBeInTheDocument();
  });

  it('replaces a trailing UUID with a readable label', () => {
    // A raw UUID is meaningless in a top-list and pushes every other row out of view.
    setup({
      realtime: realtime({
        top_pages: [{ page: '/websites/11111111-1111-4111-8111-111111111111', visitors: 4 }],
      }),
    });
    expect(within(pagesPanel()).getByText('Website dashboard')).toBeInTheDocument();
  });

  it('accepts an absolute URL as well as a path', () => {
    setup({ realtime: realtime({ top_pages: [{ page: 'https://example.com/pricing', visitors: 4 }] }) });
    expect(within(pagesPanel()).getByText('Pricing')).toBeInTheDocument();
  });

  it('keeps the raw page in the title attribute', () => {
    setup({ realtime: realtime({ top_pages: [{ page: '/pricing', visitors: 20 }] }) });
    expect(within(pagesPanel()).getByTitle('/pricing')).toBeInTheDocument();
  });

  it('renders the visitor count beside each row', () => {
    setup({ realtime: realtime({ top_pages: [{ page: '/pricing', visitors: 20 }] }) });
    expect(within(pagesPanel()).getByText('20')).toBeInTheDocument();
  });

  it('caps the list at eight rows', () => {
    setup({
      realtime: realtime({
        top_pages: Array.from({ length: 12 }, (_, i) => ({ page: `/p${i}`, visitors: 12 - i })),
      }),
    });
    expect(within(pagesPanel()).queryByText('P7')).toBeInTheDocument();
    expect(within(pagesPanel()).queryByText('P8')).not.toBeInTheDocument();
  });

  it('shows an empty message when there are no pages', () => {
    setup({ realtime: realtime({ top_pages: [] }) });
    expect(within(pagesPanel()).getByText('No data yet')).toBeInTheDocument();
  });
});

describe('top countries', () => {
  function countriesPanel(): HTMLElement {
    return screen.getByText('Top countries').closest('div.surface') as HTMLElement;
  }

  it('renders a flag beside the country code', () => {
    setup({ realtime: realtime({ top_countries: [{ name: 'US', visitors: 15 }] }) });
    expect(countriesPanel().textContent).toContain('🇺🇸');
    expect(within(countriesPanel()).getByText('US')).toBeInTheDocument();
  });

  it('falls back to a globe for a value that is not a two-letter code', () => {
    setup({ realtime: realtime({ top_countries: [{ name: 'Unknown', visitors: 2 }] }) });
    expect(countriesPanel().textContent).toContain('🌐');
  });

  it('renders a dash for a blank country code', () => {
    setup({ realtime: realtime({ top_countries: [{ name: '', visitors: 2 }] }) });
    expect(within(countriesPanel()).getByText('—')).toBeInTheDocument();
  });

  it('shows an empty message when there are no countries', () => {
    setup({ realtime: realtime({ top_countries: [] }) });
    expect(within(countriesPanel()).getByText('No data yet')).toBeInTheDocument();
  });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

describe('refresh control', () => {
  it('refetches both queries on click', () => {
    const refetchStats = vi.fn();
    const refetchActivity = vi.fn();
    hooks.isDemo.mockReturnValue(false);
    hooks.useRealtimeData.mockReturnValue({
      data: realtime(),
      isLoading: false,
      isFetching: false,
      refetch: refetchStats,
    });
    hooks.useRecentActivity.mockReturnValue({
      data: { activities: [] },
      isLoading: false,
      isFetching: false,
      refetch: refetchActivity,
    });
    render(<RealtimeDashboardSection websiteId={SITE} />);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(refetchStats).toHaveBeenCalledTimes(1);
    expect(refetchActivity).toHaveBeenCalledTimes(1);
  });

  it('is hidden in demo mode, where there is nothing to refetch', () => {
    setup({ demo: true });
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('is disabled while either query is in flight', () => {
    hooks.isDemo.mockReturnValue(false);
    hooks.useRealtimeData.mockReturnValue({
      data: realtime(),
      isLoading: false,
      isFetching: true,
      refetch: vi.fn(),
    });
    hooks.useRecentActivity.mockReturnValue({
      data: { activities: [] },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    render(<RealtimeDashboardSection websiteId={SITE} />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
