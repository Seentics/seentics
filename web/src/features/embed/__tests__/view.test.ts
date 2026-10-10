import { describe, expect, it } from 'vitest';
import { allowedTabs, resolveActiveSection, showTabStrip, viewFromHref } from '@/features/embed/view';

describe('viewFromHref', () => {
  it('maps the replay list and a single replay', () => {
    expect(viewFromHref('/websites/w1/replays')).toEqual({ section: 'recordings', sessionId: undefined });
    expect(viewFromHref('/websites/w1/replays/sess-1')).toEqual({ section: 'recordings', sessionId: 'sess-1' });
  });

  it('maps the heatmap list and a heatmap, ignoring the query', () => {
    expect(viewFromHref('/websites/w1/heatmaps')).toEqual({ section: 'heatmaps', slug: undefined });
    expect(viewFromHref('/websites/w1/heatmaps/pricing?days=7')).toEqual({ section: 'heatmaps', slug: 'pricing' });
  });

  it('returns null for anything else', () => {
    for (const h of ['/websites/w1/funnels', '/websites/w1/settings', '/signin', '/websites/w1/replays/a/b', '/websites/w1']) {
      expect(viewFromHref(h)).toBeNull();
    }
  });
});

describe('tabs', () => {
  it('only allowed sections get a tab, in display order', () => {
    expect(allowedTabs(['heatmaps', 'analytics'])).toEqual(['analytics', 'heatmaps']);
    expect(allowedTabs(['analytics'])).toEqual(['analytics']);
  });

  it('a single-section link shows no tab strip', () => {
    expect(showTabStrip(['analytics'])).toBe(false);
    expect(showTabStrip(['recordings'])).toBe(false);
    expect(showTabStrip(['analytics', 'recordings'])).toBe(true);
  });

  it('keeps the current section when allowed, else falls back to the first allowed', () => {
    expect(resolveActiveSection('recordings', ['analytics', 'recordings'])).toBe('recordings');
    expect(resolveActiveSection('recordings', ['analytics'])).toBe('analytics');
    expect(resolveActiveSection('analytics', ['heatmaps', 'recordings'])).toBe('recordings');
    expect(resolveActiveSection('heatmaps', [])).toBe('analytics');
  });
});
