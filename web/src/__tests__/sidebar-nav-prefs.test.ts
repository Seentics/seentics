import { describe, expect, it } from 'vitest';
import { parseHidden, storageKey, visibleItems, type NavId } from '@/features/sidebar/nav-prefs';

const items = (['overview', 'recording', 'heatmaps', 'revenue', 'settings'] as NavId[]).map((id) => ({ id }));

describe('sidebar pages a person keeps', () => {
  it('reads the stored list, dropping unknown ids, repeats, and the pages that cannot be hidden', () => {
    expect(parseHidden('["heatmaps","heatmaps","nope","overview","settings","revenue"]')).toEqual(['heatmaps', 'revenue']);
    expect(parseHidden(null)).toEqual([]);
    expect(parseHidden('not json')).toEqual([]);
    expect(parseHidden('{"heatmaps":true}')).toEqual([]);
  });

  it('lists everything not hidden, and the page you are on even when it is', () => {
    expect(visibleItems(items, ['heatmaps', 'revenue'], 'overview').map((i) => i.id)).toEqual(['overview', 'recording', 'settings']);
    expect(visibleItems(items, ['heatmaps', 'revenue'], 'revenue').map((i) => i.id)).toEqual(['overview', 'recording', 'revenue', 'settings']);
  });

  it('keeps each person’s choice apart', () => {
    expect(storageKey('u1')).not.toBe(storageKey('u2'));
    expect(storageKey(undefined)).toBe('seentics-sidebar-hidden:anon');
  });
});
