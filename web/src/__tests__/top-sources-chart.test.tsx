import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { categorizeReferrer, selectTopReferrers } from '@/features/analytics/selectors';

const row = (referrer: string, visitors = 1) => ({ referrer, visitors, page_views: visitors, avg_session_duration: 0 });

describe('categorizeReferrer', () => {
  it('names a source by its host, never by a piece of it', () => {
    expect(categorizeReferrer('www.google.com')).toBe('Google');
    expect(categorizeReferrer('news.ycombinator.com')).toBe('Hacker News');
    expect(categorizeReferrer('direct')).toBe('Direct');
    expect(categorizeReferrer('notgoogle.example.org')).toBe('notgoogle.example.org');
    expect(categorizeReferrer('wix.com')).toBe('wix.com');
    expect(categorizeReferrer('ghost.org')).toBe('ghost.org');
    expect(categorizeReferrer('https://t.co/abc')).toBe('X (Twitter)');
  });
});

describe('selectTopReferrers', () => {
  it('merges domains that are one source and keeps the rest apart', () => {
    const { top_referrers } = selectTopReferrers({
      top_referrers: [
        { referrer: 'google.com', views: 3, unique: 2 },
        { referrer: 'google.de', views: 1, unique: 1 },
        { referrer: 'direct', views: 5, unique: 4 },
        { referrer: 'indiehackers.com', views: 1, unique: 1 },
      ],
    });
    const byName = Object.fromEntries(top_referrers.map((r) => [r.referrer, r.visitors]));
    expect(byName).toEqual({ Direct: 4, Google: 3, 'indiehackers.com': 1 });
  });
});

describe('TopSourcesChart', () => {
  it('does not call a host that merely contains "direct" Direct', () => {
    render(<TopSourcesChart data={{ top_referrers: [row('redirect.example.com', 4), row('Direct', 2)] }} />);
    expect(screen.getByText('redirect.example.com')).toBeTruthy();
    expect(screen.getAllByText('Direct')).toHaveLength(1);
  });

  it('keeps a sign-in return and a research site out of the Search tab', () => {
    render(
      <TopSourcesChart
        activeTab="search"
        data={{ top_referrers: [row('Google', 3), row('Google OAuth', 2), row('researchgate.net', 1), row('Bing', 1)] }}
      />,
    );
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('Bing')).toBeTruthy();
    expect(screen.queryByText('Google OAuth')).toBeNull();
    expect(screen.queryByText('researchgate.net')).toBeNull();
  });

  it('puts only social networks under Social', () => {
    render(
      <TopSourcesChart
        activeTab="social"
        data={{ top_referrers: [row('Facebook', 2), row('X (Twitter)', 1), row('mixcloud.com', 1), row('Direct', 3)] }}
      />,
    );
    expect(screen.getByText('Facebook')).toBeTruthy();
    expect(screen.getByText('X (Twitter)')).toBeTruthy();
    expect(screen.queryByText('mixcloud.com')).toBeNull();
    expect(screen.queryByText('Direct')).toBeNull();
  });
});
