import { describe, expect, it } from 'vitest';
import { inSessionGroup, SESSION_GROUP_META } from '@/features/replays/groups';

const row = (over: Record<string, unknown> = {}) => ({
  frustration_score: null, signal_counts: null, has_errors: false, has_rage_clicks: false, summary: null, ...over,
}) as never;

describe('session groups', () => {
  it('puts an analysed session with no friction in Smooth, and only there', () => {
    const r = row({ frustration_score: 0, signal_counts: {} });
    expect(SESSION_GROUP_META.filter((g) => inSessionGroup(r, g.id)).map((g) => g.id)).toEqual(['smooth']);
  });

  it('groups by signals and by the ingest flags, so unanalysed sessions still group', () => {
    expect(inSessionGroup(row({ has_errors: true }), 'errors')).toBe(true);
    expect(inSessionGroup(row({ signal_counts: { rage_click: 2 } }), 'rage')).toBe(true);
    expect(inSessionGroup(row({ signal_counts: { dead_click: 1, u_turn: 1 } }), 'dead_clicks')).toBe(true);
    expect(inSessionGroup(row({ signal_counts: { dead_click: 1, u_turn: 1 } }), 'u_turns')).toBe(true);
    expect(inSessionGroup(row({ has_errors: true, frustration_score: 0 }), 'smooth')).toBe(false);
  });

  it('counts a session whose summary says it left without doing what it came for as Gave up', () => {
    const r = row({ frustration_score: 5, summary: 'Tried to buy Pro; the coupon failed and they left without paying.' });
    expect(inSessionGroup(r, 'gave_up')).toBe(true);
    expect(inSessionGroup(r, 'smooth')).toBe(false);
  });
});
