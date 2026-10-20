import { describe, expect, it } from 'vitest';
import { arrangeNav, PROFILE_NAV } from '@/features/sidebar/profiles';
import { NAV_IDS, type NavId } from '@/features/sidebar/nav-prefs';

const items = (ids: readonly NavId[]) => ids.map((id) => ({ id }));
const MAIN: NavId[] = ['overview', 'recording', 'heatmaps', 'funnels', 'automations', 'leads', 'revenue', 'conversions', 'ai-reports', 'errors'];

describe('arrangeNav', () => {
  it('keeps the usual order, all primary, with no profile', () => {
    const { primary, more } = arrangeNav(items(MAIN), null);
    expect(primary.map((i) => i.id)).toEqual(MAIN);
    expect(more).toEqual([]);
  });

  it("puts a store's pages first in the profile's order and the rest under More", () => {
    const { primary, more } = arrangeNav(items(MAIN), 'store');
    expect(primary.map((i) => i.id)).toEqual(['overview', 'conversions', 'revenue', 'funnels', 'recording', 'heatmaps']);
    expect(more.map((i) => i.id)).toEqual(['automations', 'leads', 'ai-reports', 'errors']);
  });

  it('skips profile pages the site does not have (a client without Funnels)', () => {
    const { primary } = arrangeNav(items(MAIN.filter((id) => id !== 'funnels')), 'store');
    expect(primary.map((i) => i.id)).toEqual(['overview', 'conversions', 'revenue', 'recording', 'heatmaps']);
  });

  it('never loses or repeats a page', () => {
    for (const profile of Object.keys(PROFILE_NAV) as (keyof typeof PROFILE_NAV)[]) {
      const { primary, more } = arrangeNav(items(MAIN), profile);
      expect([...primary, ...more].map((i) => i.id).sort()).toEqual([...MAIN].sort());
    }
  });

  it('every profile lists only known pages and starts with Overview', () => {
    for (const ids of Object.values(PROFILE_NAV)) {
      expect(ids.every((id) => (NAV_IDS as readonly string[]).includes(id))).toBe(true);
      expect(ids[0]).toBe('overview');
    }
  });
});
