import { describe, expect, it } from 'vitest';
import { errorLine, inErrorGroup } from '@/features/errors/insights';
import type { ErrorGroup } from '@/features/errors/types';

const NOW = Date.parse('2026-03-05T00:00:00Z');
const START = NOW - 7 * 86_400_000;
const g = (over: Partial<ErrorGroup>): ErrorGroup => ({
  id: 'g', fingerprint: 'f', kind: 'error', message: 'TypeError: x is undefined', source_file: '', line_no: null,
  status: 'unresolved', event_count: 0, last_page_path: '/', first_seen: '2026-01-01T00:00:00Z', last_seen: '2026-03-04T00:00:00Z',
  ...over,
});

describe('error lines', () => {
  it('says a new error, how often, where, and who it hit', () => {
    const line = errorLine(g({ first_seen: '2026-03-04T09:00:00Z', window: { count: 96, prev_count: 0, sessions: 14, pages: ['/checkout'] } }), START, 'in the last 7 days');
    expect(line).toBe('New · 96 times on /checkout in the last 7 days, 14 visitors affected');
  });

  it('shows the trend against the period before', () => {
    expect(errorLine(g({ window: { count: 187, prev_count: 41, sessions: 64, pages: ['/cart', '/checkout'] } }), START, 'this week'))
      .toBe('Up from 41 · 187 times on /cart and /checkout this week, 64 visitors affected');
    expect(errorLine(g({ window: { count: 3, prev_count: 31, sessions: 3, pages: [] } }), START, 'this week')).toMatch(/^Down from 31/);
  });

  it('calls a browser warning harmless instead of alarming', () => {
    expect(errorLine(g({ message: 'ResizeObserver loop completed with undelivered notifications.', window: { count: 214, prev_count: 198, sessions: 171, pages: ['/'] } }), START, 'this week'))
      .toMatch(/^Browser warning — usually harmless/);
  });
});

describe('error groups', () => {
  it('puts each error where it belongs, and harmless warnings only under Noisy', () => {
    const resize = g({ message: 'ResizeObserver loop completed', first_seen: '2026-03-04T00:00:00Z', last_page_path: '/checkout', window: { count: 50, prev_count: 1, sessions: 40, pages: ['/checkout'] } });
    expect(['new', 'worse', 'key_pages', 'better'].some((id) => inErrorGroup(resize, id as never, START))).toBe(false);
    expect(inErrorGroup(resize, 'noisy', START)).toBe(true);
    const checkout = g({ window: { count: 30, prev_count: 10, sessions: 9, pages: ['/checkout'] } });
    expect(inErrorGroup(checkout, 'worse', START)).toBe(true);
    expect(inErrorGroup(checkout, 'key_pages', START)).toBe(true);
    expect(inErrorGroup(g({ window: { count: 3, prev_count: 31, sessions: 3, pages: [] } }), 'better', START)).toBe(true);
  });
});
