/**
 * The demo's "now": every demo date is an offset from it.
 *
 * The start of the current hour, so the demo always reads as a live site — sessions "2h ago",
 * charts ending today, date pickers over the data they show. It was fixed at 2025-03-31, which
 * a visitor read as a site nobody had touched in a year and a half ("564d ago").
 *
 * Fixed where the demo must not move: unit tests, and captures that set
 * NEXT_PUBLIC_DEMO_FIXED_DATE so a video shows the same figures every time. Read once per page
 * load, so it does not shift while someone is looking at it.
 */
const FIXED_DEMO_DATE = '2025-03-31T12:00:00.000Z';
const HOUR_MS = 3_600_000;

function demoNow(): Date {
  const pinned = process.env.NEXT_PUBLIC_DEMO_FIXED_DATE || (process.env.NODE_ENV === 'test' ? FIXED_DEMO_DATE : '');
  if (pinned) return new Date(pinned);
  return new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
}

/** Seeded generator and a clock read once keep demo routes stable across renders. */
export const DEMO_REFERENCE_DATE = demoNow();

export function demoDate(offsetMs = 0): Date {
  return new Date(DEMO_REFERENCE_DATE.getTime() + offsetMs);
}

export function createDemoRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
