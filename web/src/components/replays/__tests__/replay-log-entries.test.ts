import { describe, expect, it } from 'vitest';
import { buildReplayLogEntries } from '../session-replay-surface';
import type { RRWebEvent } from '@/features/replays/types';

const meta = (timestamp: number, href: string): RRWebEvent => ({ type: 4, timestamp, data: { href, width: 1600, height: 900 } });
const full = (timestamp: number): RRWebEvent => ({ type: 2, timestamp, data: {} });
const move = (timestamp: number): RRWebEvent => ({ type: 3, timestamp, data: { source: 1 } });

describe('buildReplayLogEntries', () => {
  // rrweb's order on every load: Meta, then FullSnapshot a few ms later.
  const events = [
    meta(1000, 'https://shop.example/'), full(1030), move(5000),
    meta(12_000, 'https://shop.example/products/pack'), full(12_010), move(15_000),
    meta(25_000, 'https://shop.example/cart'), full(25_020), move(40_000),
  ];

  it('labels each page with its own URL at its own time', () => {
    const rows = buildReplayLogEntries(events).filter((e) => e.kind === 'start' || e.kind === 'page');
    expect(rows.map((r) => [r.detail, r.offsetMs])).toEqual([
      ['/', 0],
      ['/products/pack', 11_010],
      ['/cart', 24_020],
    ]);
  });
});
