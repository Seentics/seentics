import { describe, expect, it } from 'bun:test';
import type { AnalyticsInsightReads, InsightSnapshotData } from '../../../analytics/interfaces';
import type { ErrorGroupSummary, ErrorGroupWindowCount } from '../../../errors/interfaces';
import { readInsightSnapshot, type SnapshotSources } from '../snapshot';

const NOW = new Date('2026-10-13T05:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const pair = (cur: number, prev: number) => ({ cur, prev });

const data: InsightSnapshotData = {
  days: 7,
  traffic: { visitors: pair(500, 500), pageviews: pair(900, 900), sessions: pair(600, 600), bounces: pair(200, 200), durationSec: pair(6000, 6000) },
  devices: [],
  channels: [],
  pages: [],
  conversion: null,
};
const analytics = { getInsightSnapshot: async () => data } as unknown as AnalyticsInsightReads;

const group = (over: Partial<ErrorGroupSummary>): ErrorGroupSummary => ({
  id: 'g', fingerprint: 'f', kind: 'error', message: 'TypeError: x is undefined', source_file: '', line_no: null,
  status: 'unresolved', event_count: 50_000, last_page_path: '/checkout', first_seen: ago(400), last_seen: ago(0), ...over,
});
const counted = (over: Partial<ErrorGroupWindowCount>): ErrorGroupWindowCount => ({
  fingerprint: 'f', message: 'TypeError: x is undefined', last_page_path: '/checkout', first_seen: ago(400), last_seen: ago(0), window_count: 1, ...over,
});

describe('readInsightSnapshot errors', () => {
  it('reports occurrences inside the window, most frequent first, never the lifetime total', async () => {
    const src: SnapshotSources = {
      analytics,
      errors: {
        listGroups: async () => ({ groups: [group({})] }),
        listGroupsByWindowCount: async () => [
          counted({ fingerprint: 'recent-but-rare', message: 'Rare', window_count: 12, first_seen: ago(2) }),
          counted({ fingerprint: 'old-but-frequent', message: 'Frequent', window_count: 340, last_page_path: '/orders/884213' }),
        ],
      },
    };
    const snap = await readInsightSnapshot(src, 'site', 7, NOW);
    expect(snap.errors).toEqual([
      { message: 'Frequent', page: '/orders/:id', count: 340, isNew: false },
      { message: 'Rare', page: '/checkout', count: 12, isNew: true },
    ]);
  });

  it('falls back to the group list when the occurrence read fails: only new faults, with no count', async () => {
    const src: SnapshotSources = {
      analytics,
      errors: {
        listGroups: async () => ({ groups: [
          group({ message: 'Old fault', first_seen: ago(400), event_count: 50_000 }),
          group({ message: 'New fault', first_seen: ago(1), event_count: 7_000 }),
        ] }),
        listGroupsByWindowCount: async () => { throw new Error('db down'); },
      },
    };
    const snap = await readInsightSnapshot(src, 'site', 7, NOW);
    expect(snap.errors).toEqual([{ message: 'New fault', page: '/checkout', count: null, isNew: true }]);
  });
});
