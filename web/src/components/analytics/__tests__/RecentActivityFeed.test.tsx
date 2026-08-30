import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RecentActivityFeed } from '@/components/analytics/RecentActivityFeed';

/**
 * The live activity feed.
 *
 * Every row is data the tracker collected from a real browser, which means every field
 * can be missing and the timestamp can arrive in more than one shape. The feed's job is
 * to render *something* for each one — a blank cell reads as a rendering bug, and a
 * timestamp parsed in the wrong zone makes a visitor from a minute ago look like one
 * from yesterday. Both are asserted here against rendered text.
 */

const WEBSITE = 'ab12cd34';
const NOW = new Date('2026-03-01T12:00:00.000Z');

function activity(over: Partial<Record<string, string>> = {}) {
  return {
    page: 'https://example.com/pricing',
    country: 'United States',
    device: 'desktop',
    browser: 'Chrome',
    os: 'macOS',
    referrer: 'https://www.google.com/search?q=x',
    timestamp: '2026-03-01T11:59:30.000Z',
    ...over,
  };
}

function renderTable(activities: ReturnType<typeof activity>[], props = {}) {
  return render(
    <RecentActivityFeed data={{ activities }} rowLayout="table" websiteId={WEBSITE} {...props} />,
  );
}

/** The single data row's cells, in column order. */
function rowCells(): HTMLElement[] {
  const rows = screen.getAllByRole('row');
  // Row 0 is the header.
  return within(rows[1]!).getAllByRole('cell');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Structure ───────────────────────────────────────────────────────────────

describe('table layout', () => {
  it('renders one row per activity under the seven expected columns', () => {
    renderTable([activity(), activity({ page: '/about' })]);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Page', 'Country', 'Device', 'OS', 'Browser', 'Source', 'Time']);
    // Header row plus two data rows.
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('shows an empty state rather than an empty table', () => {
    renderTable([]);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows skeletons while loading and no empty state', () => {
    const { container } = render(
      <RecentActivityFeed data={{ activities: [] }} rowLayout="table" isLoading />,
    );
    expect(screen.queryByText('No recent activity')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('treats a missing data prop as empty rather than throwing', () => {
    expect(() => render(<RecentActivityFeed rowLayout="table" />)).not.toThrow();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('merges a caller-supplied class onto the scroll container', () => {
    const { container } = render(
      <RecentActivityFeed
        data={{ activities: [activity()] }}
        rowLayout="table"
        tableScrollClassName="test-scroll-marker"
      />,
    );
    expect(container.querySelector('.test-scroll-marker')).toBeTruthy();
  });

  it('renders the stack layout by default, with its own heading', () => {
    render(<RecentActivityFeed data={{ activities: [activity()] }} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Live Activity')).toBeInTheDocument();
  });

  it('omits the heading when embedded in a parent card', () => {
    render(<RecentActivityFeed data={{ activities: [activity()] }} embed />);
    expect(screen.queryByText('Live Activity')).not.toBeInTheDocument();
  });
});

// ─── Page column ─────────────────────────────────────────────────────────────

describe('page column', () => {
  it('reduces a tracked URL to its path', () => {
    renderTable([activity({ page: 'https://example.com/pricing?ref=x' })]);
    expect(rowCells()[0]!).toHaveTextContent('/pricing?ref=x');
  });

  it('strips the dashboard prefix when a website id is supplied', () => {
    renderTable([activity({ page: `https://app.example.com/websites/${WEBSITE}/realtime` })]);
    expect(rowCells()[0]!).toHaveTextContent('/realtime');
  });

  it('keeps the full URL in the title attribute for copying', () => {
    const full = 'https://example.com/a/very/long/path';
    renderTable([activity({ page: full })]);
    expect(within(rowCells()[0]!).getByTitle(full)).toBeInTheDocument();
  });

  it('truncates a very long path without a website id', () => {
    render(
      <RecentActivityFeed
        data={{ activities: [activity({ page: `/${'a'.repeat(100)}` })] }}
        rowLayout="table"
      />,
    );
    expect(rowCells()[0]!.textContent!.endsWith('…')).toBe(true);
  });

  it('renders an empty page without crashing', () => {
    expect(() => renderTable([activity({ page: '' })])).not.toThrow();
  });
});

// ─── Country column ──────────────────────────────────────────────────────────

describe('country column', () => {
  it('renders a flag alongside the country name', () => {
    renderTable([activity({ country: 'United States' })]);
    const cell = rowCells()[1]!;
    expect(cell).toHaveTextContent('United States');
    expect(cell.textContent).toContain('🇺🇸');
  });

  it('maps a two-letter code straight to its flag', () => {
    renderTable([activity({ country: 'BD' })]);
    expect(rowCells()[1]!.textContent).toContain('🇧🇩');
  });

  it('falls back to a globe icon for an unmappable country', () => {
    // 'Wakanda' has no ISO code, so `getCountryFlag` returns '' and the icon stands in.
    const { container } = renderTable([activity({ country: 'Wakanda' })]);
    expect(rowCells()[1]!).toHaveTextContent('Wakanda');
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders a dash for a missing country rather than a blank cell', () => {
    renderTable([activity({ country: '' })]);
    expect(rowCells()[1]!).toHaveTextContent('—');
  });
});

// ─── Device, OS, browser columns ─────────────────────────────────────────────

describe('device, OS and browser columns', () => {
  it('labels each icon for screen readers', () => {
    renderTable([activity({ device: 'mobile', os: 'iOS', browser: 'Safari' })]);
    expect(screen.getByLabelText('mobile')).toBeInTheDocument();
    expect(screen.getByLabelText('iOS')).toBeInTheDocument();
    expect(screen.getByLabelText('Safari')).toBeInTheDocument();
  });

  it('renders a dash for each missing dimension', () => {
    renderTable([activity({ device: '', os: '', browser: '' })]);
    const cells = rowCells();
    expect(cells[2]!).toHaveTextContent('—');
    expect(cells[3]!).toHaveTextContent('—');
    expect(cells[4]!).toHaveTextContent('—');
  });

  it('treats a whitespace-only value as missing', () => {
    renderTable([activity({ device: '   ' })]);
    expect(rowCells()[2]!).toHaveTextContent('—');
  });

  it('does not render an icon for a missing dimension', () => {
    renderTable([activity({ device: '', os: 'macOS', browser: 'Chrome' })]);
    expect(screen.queryByLabelText('desktop')).not.toBeInTheDocument();
    expect(screen.getByLabelText('macOS')).toBeInTheDocument();
  });
});

// ─── Source column ───────────────────────────────────────────────────────────

describe('source column', () => {
  it('reduces an external referrer to its hostname', () => {
    renderTable([activity({ referrer: 'https://www.google.com/search?q=x' })]);
    expect(rowCells()[5]!).toHaveTextContent('google.com');
  });

  it('shows the path for a localhost referrer, stripped of the dashboard prefix', () => {
    renderTable([activity({ referrer: `http://localhost:3000/websites/${WEBSITE}/heatmaps` })]);
    expect(rowCells()[5]!).toHaveTextContent('/heatmaps');
  });

  it('renders a dash for direct traffic rather than a blank cell', () => {
    renderTable([activity({ referrer: '' })]);
    expect(rowCells()[5]!).toHaveTextContent('—');
  });
});

// ─── Time column ─────────────────────────────────────────────────────────────

describe('relative time', () => {
  const cases: Array<[string, string]> = [
    ['2026-03-01T11:59:58.000Z', 'just now'],
    ['2026-03-01T11:59:55.000Z', '5s ago'],
    ['2026-03-01T11:59:00.000Z', '1m ago'],
    ['2026-03-01T11:30:00.000Z', '30m ago'],
    ['2026-03-01T11:00:00.000Z', '1h ago'],
    ['2026-02-28T12:00:00.000Z', '1d ago'],
    ['2026-02-01T12:00:00.000Z', '28d ago'],
  ];

  for (const [timestamp, expected] of cases) {
    it(`renders ${timestamp} as "${expected}"`, () => {
      renderTable([activity({ timestamp })]);
      expect(rowCells()[6]!).toHaveTextContent(expected);
    });
  }

  it('treats a naive timestamp as UTC rather than local time', () => {
    // The API sends ISO with a Z, but older rows arrive without one. Parsing those as
    // local time shifts every entry by the reader's offset — on a UTC+6 machine a
    // visitor from a minute ago shows as six hours ago.
    renderTable([activity({ timestamp: '2026-03-01T11:59:00.000' })]);
    expect(rowCells()[6]!).toHaveTextContent('1m ago');
  });

  it('respects an explicit non-UTC offset', () => {
    renderTable([activity({ timestamp: '2026-03-01T16:59:00.000+05:00' })]);
    expect(rowCells()[6]!).toHaveTextContent('1m ago');
  });

  it('clamps a future timestamp to "just now" rather than a negative age', () => {
    // Clock skew between a visitor's browser and the server is routine.
    renderTable([activity({ timestamp: '2026-03-01T12:05:00.000Z' })]);
    expect(rowCells()[6]!).toHaveTextContent('just now');
  });

  it('marks recent rows with a live indicator and older ones without', () => {
    const { container } = renderTable([activity({ timestamp: '2026-03-01T11:59:55.000Z' })]);
    expect(container.querySelectorAll('.animate-ping').length).toBeGreaterThan(0);
  });

  it('does not mark a minutes-old row as live', () => {
    const { container } = renderTable([activity({ timestamp: '2026-03-01T11:30:00.000Z' })]);
    expect(container.querySelectorAll('tbody .animate-ping')).toHaveLength(0);
  });
});

// ─── Ordering ────────────────────────────────────────────────────────────────

describe('ordering', () => {
  it('renders rows in the order supplied — the API already sorted them', () => {
    renderTable([
      activity({ page: '/first', timestamp: '2026-03-01T11:59:50.000Z' }),
      activity({ page: '/second', timestamp: '2026-03-01T11:59:00.000Z' }),
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]!).getAllByRole('cell')[0]!).toHaveTextContent('/first');
    expect(within(rows[1]!).getAllByRole('cell')[0]!).toHaveTextContent('/second');
  });

  it('renders duplicate timestamps as separate rows', () => {
    // The React key is `${timestamp}-${index}`; a key on timestamp alone would collapse
    // two events recorded in the same millisecond into one row.
    const t = '2026-03-01T11:59:00.000Z';
    renderTable([activity({ page: '/a', timestamp: t }), activity({ page: '/b', timestamp: t })]);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});
