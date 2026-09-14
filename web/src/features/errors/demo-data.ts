import type { ErrorGroup, ErrorSample } from './types';

/**
 * Deterministic fixtures for demos, visual checks and marketing recordings.
 *
 * Fixed ids, fixed dates, fixed counts — no `Math.random()`, no `Date.now()`, and no
 * time-relative labels. A recording rendered twice must produce identical frames, and a
 * fixture that drifts makes a re-render differ from the take that was approved.
 *
 * The content these describe is invented product data, never a real customer's.
 */
export const ERROR_GROUPS_DEMO_DATA: ErrorGroup[] = [
  {
    id: 'demo-group-checkout',
    fingerprint: 'demo0000000000000000000000000000000000000000000000000000checkout',
    kind: 'error',
    message: "TypeError: Cannot read properties of undefined (reading 'total')",
    source_file: '/_next/static/chunks/checkout.js',
    line_no: 214,
    status: 'unresolved',
    event_count: 412,
    last_page_path: '/checkout',
    first_seen: '2026-03-01T09:12:00.000Z',
    last_seen: '2026-03-04T16:48:00.000Z',
  },
  {
    id: 'demo-group-cart',
    fingerprint: 'demo00000000000000000000000000000000000000000000000000000000cart',
    kind: 'unhandledrejection',
    message: 'Failed to fetch /api/cart',
    source_file: 'promise',
    line_no: null,
    status: 'unresolved',
    event_count: 187,
    last_page_path: '/cart',
    first_seen: '2026-03-02T11:30:00.000Z',
    last_seen: '2026-03-04T15:02:00.000Z',
  },
  {
    id: 'demo-group-search',
    fingerprint: 'demo000000000000000000000000000000000000000000000000000000search',
    kind: 'error',
    message: 'ReferenceError: analytics is not defined',
    source_file: '/_next/static/chunks/search.js',
    line_no: 88,
    status: 'resolved',
    event_count: 34,
    last_page_path: '/search',
    first_seen: '2026-02-18T08:05:00.000Z',
    last_seen: '2026-02-26T13:20:00.000Z',
  },
];

export const ERROR_SAMPLES_DEMO_DATA: ErrorSample[] = [
  {
    id: 'demo-sample-1',
    message: "TypeError: Cannot read properties of undefined (reading 'total')",
    stack:
      "TypeError: Cannot read properties of undefined (reading 'total')\n" +
      '    at renderSummary (checkout.js:214:18)\n' +
      '    at CheckoutSummary (checkout.js:180:7)',
    source_file: '/_next/static/chunks/checkout.js',
    line_no: 214,
    col_no: 18,
    page_path: '/checkout',
    // Present on purpose: the replay link is the feature's whole argument, so the first
    // fixture must exercise it.
    session_id: 'demo-session-4821',
    visitor_id: 'demo-visitor-118',
    browser: 'Chrome 121',
    os: 'macOS 14',
    device_type: 'Desktop',
    occurred_at: '2026-03-04T16:48:00.000Z',
  },
  {
    id: 'demo-sample-2',
    message: "TypeError: Cannot read properties of undefined (reading 'total')",
    stack:
      "TypeError: Cannot read properties of undefined (reading 'total')\n" +
      '    at renderSummary (checkout.js:214:18)',
    source_file: '/_next/static/chunks/checkout.js',
    line_no: 214,
    col_no: 18,
    page_path: '/checkout',
    // Absent on purpose: a visitor sampled out of recording is the other real case, and
    // the component has to render it without an empty button.
    session_id: null,
    visitor_id: 'demo-visitor-204',
    browser: 'Safari 17',
    os: 'iOS 17',
    device_type: 'Mobile',
    occurred_at: '2026-03-04T14:11:00.000Z',
  },
];
