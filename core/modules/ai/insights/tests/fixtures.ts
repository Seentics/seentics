import type { InsightSnapshot } from '../types';

const pair = (cur: number, prev: number) => ({ cur, prev });

/** A busy, steady site: nothing in it should be worth a line. */
export function steadySnapshot(over: Partial<InsightSnapshot> = {}): InsightSnapshot {
  return {
    websiteId: '00000000-0000-4000-8000-000000000001',
    days: 7,
    traffic: {
      visitors: pair(5000, 4900), pageviews: pair(14000, 13800), sessions: pair(6000, 5900),
      bounceRate: pair(42, 41), avgSessionSec: pair(120, 118),
    },
    devices: [
      { name: 'Desktop', sessions: pair(3500, 3450), bounceRate: pair(38, 38), conversions: pair(140, 138) },
      { name: 'Mobile', sessions: pair(2400, 2380), bounceRate: pair(47, 46), conversions: pair(72, 71) },
    ],
    channels: [
      { name: 'google', visitors: pair(2200, 2150), sessions: pair(2600, 2550), pagesPerSession: pair(2.3, 2.3), bounceRate: pair(41, 41) },
      { name: 'direct', visitors: pair(1500, 1480), sessions: pair(1800, 1770), pagesPerSession: pair(2.4, 2.4), bounceRate: pair(40, 40) },
    ],
    pages: [{ path: '/', views: pair(4000, 3950) }, { path: '/pricing', views: pair(1500, 1480) }],
    conversion: { event: 'purchase', count: pair(212, 209) },
    errors: [],
    ...over,
  };
}

/** The week the doc describes: mobile conversion falls, one channel is unusually engaged, an error appears. */
export function troubledSnapshot(): InsightSnapshot {
  return steadySnapshot({
    traffic: {
      visitors: pair(4300, 5100), pageviews: pair(12000, 14100), sessions: pair(5200, 6100),
      bounceRate: pair(55, 44), avgSessionSec: pair(95, 118),
    },
    devices: [
      { name: 'Desktop', sessions: pair(2800, 3300), bounceRate: pair(40, 38), conversions: pair(120, 140) },
      { name: 'Mobile', sessions: pair(2400, 2800), bounceRate: pair(66, 52), conversions: pair(34, 66) },
    ],
    channels: [
      { name: 'instagram', visitors: pair(600, 560), sessions: pair(700, 650), pagesPerSession: pair(4.6, 4.5), bounceRate: pair(30, 31) },
      { name: 'google', visitors: pair(2000, 2400), sessions: pair(2400, 2800), pagesPerSession: pair(2.2, 2.3), bounceRate: pair(50, 40) },
    ],
    pages: [{ path: '/checkout', views: pair(700, 1300) }, { path: '/', views: pair(3900, 4100) }],
    conversion: { event: 'purchase', count: pair(154, 206) },
    errors: [{ message: "TypeError: Cannot read properties of undefined (reading 'price')", page: '/checkout', count: 84, isNew: true }],
  });
}
