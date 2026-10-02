/**
 * Demo error groups and samples for the Errors page (websiteId === "demo").
 *
 * Samples link to the demo replay sessions, so "Watch replay" opens a real demo route.
 */
import type { ErrorGroup, ErrorGroupDetail, ErrorGroupFilters, ErrorSample } from '@/features/errors/types';
import { createDemoRandom, demoDate } from './fixture-utils';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const FAULTS: Array<Omit<ErrorGroup, 'id' | 'fingerprint' | 'kind' | 'first_seen' | 'last_seen'> & {
  firstSeenAgo: number; lastSeenAgo: number; stack: string;
}> = [
  {
    message: "TypeError: Cannot read properties of undefined (reading 'price')",
    source_file: '/_next/static/chunks/pricing-table.js', line_no: 214,
    status: 'unresolved', event_count: 1284, last_page_path: '/pricing',
    firstSeenAgo: 6 * DAY, lastSeenAgo: 0.2 * HOUR,
    stack: "TypeError: Cannot read properties of undefined (reading 'price')\n    at PlanCard (pricing-table.js:214:31)\n    at renderWithHooks (react-dom.js:10731:18)\n    at updateFunctionComponent (react-dom.js:13021:20)",
  },
  {
    message: 'ChunkLoadError: Loading chunk 412 failed.',
    source_file: '/_next/static/chunks/webpack.js', line_no: 1,
    status: 'unresolved', event_count: 642, last_page_path: '/features',
    firstSeenAgo: 4 * DAY, lastSeenAgo: 1.5 * HOUR,
    stack: 'ChunkLoadError: Loading chunk 412 failed.\n(missing: /_next/static/chunks/412.9f3c1e.js)\n    at __webpack_require__.f.j (webpack.js:1:3820)\n    at Array.reduce (<anonymous>)',
  },
  {
    message: 'Error: Network request failed: POST /api/checkout/session (502)',
    source_file: '/_next/static/chunks/checkout.js', line_no: 88,
    status: 'unresolved', event_count: 317, last_page_path: '/checkout',
    firstSeenAgo: 2 * DAY, lastSeenAgo: 3 * HOUR,
    stack: 'Error: Network request failed: POST /api/checkout/session (502)\n    at createSession (checkout.js:88:11)\n    at async onSubmit (checkout.js:152:5)',
  },
  {
    message: "ReferenceError: Intercom is not defined",
    source_file: '/_next/static/chunks/support-widget.js', line_no: 12,
    status: 'unresolved', event_count: 205, last_page_path: '/docs/introduction',
    firstSeenAgo: 5 * DAY, lastSeenAgo: 6 * HOUR,
    stack: 'ReferenceError: Intercom is not defined\n    at openChat (support-widget.js:12:5)\n    at HTMLButtonElement.onclick (docs/introduction:1:1)',
  },
  {
    message: "TypeError: Failed to execute 'observe' on 'IntersectionObserver': parameter 1 is not of type 'Element'.",
    source_file: '/_next/static/chunks/lazy-image.js', line_no: 47,
    status: 'unresolved', event_count: 96, last_page_path: '/blog/getting-started',
    firstSeenAgo: 3 * DAY, lastSeenAgo: 11 * HOUR,
    stack: "TypeError: Failed to execute 'observe' on 'IntersectionObserver': parameter 1 is not of type 'Element'.\n    at LazyImage (lazy-image.js:47:14)\n    at commitHookEffectListMount (react-dom.js:23150:26)",
  },
  {
    message: 'SyntaxError: Unexpected token < in JSON at position 0',
    source_file: '/_next/static/chunks/signup-form.js', line_no: 63,
    status: 'resolved', event_count: 58, last_page_path: '/signup',
    firstSeenAgo: 6.5 * DAY, lastSeenAgo: 2 * DAY,
    stack: 'SyntaxError: Unexpected token < in JSON at position 0\n    at JSON.parse (<anonymous>)\n    at submitSignup (signup-form.js:63:24)',
  },
  {
    message: 'ResizeObserver loop completed with undelivered notifications.',
    source_file: '', line_no: null,
    status: 'ignored', event_count: 2410, last_page_path: '/',
    firstSeenAgo: 7 * DAY, lastSeenAgo: 0.5 * HOUR,
    stack: 'ResizeObserver loop completed with undelivered notifications.',
  },
];

const groups: ErrorGroup[] = FAULTS.map((f, i) => ({
  id: `demo-error-${i + 1}`,
  fingerprint: `demo-fp-${i + 1}`,
  kind: 'error',
  message: f.message,
  source_file: f.source_file,
  line_no: f.line_no,
  status: f.status,
  event_count: f.event_count,
  last_page_path: f.last_page_path,
  first_seen: demoDate(-f.firstSeenAgo).toISOString(),
  last_seen: demoDate(-f.lastSeenAgo).toISOString(),
}));

const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const OSES = ['macOS', 'Windows', 'iOS', 'Android'];
const DEVICES = ['desktop', 'mobile', 'tablet'];

export function demoErrorGroups(filters: ErrorGroupFilters): ErrorGroup[] {
  const since = demoDate(-filters.days * DAY).getTime();
  const search = filters.search?.trim().toLowerCase() ?? '';
  return groups
    .filter((g) => new Date(g.last_seen).getTime() >= since)
    .filter((g) => !filters.status || g.status === filters.status)
    .filter((g) => !search
      || g.message.toLowerCase().includes(search)
      || g.source_file.toLowerCase().includes(search))
    .sort((a, b) => b.event_count - a.event_count);
}

export function demoErrorGroup(fingerprint: string): ErrorGroupDetail {
  const index = groups.findIndex((g) => g.fingerprint === fingerprint);
  if (index < 0) return { group: null, samples: [] };
  const group = groups[index]!;
  const fault = FAULTS[index]!;
  const random = createDemoRandom(`errors-${fingerprint}`);
  const lastSeen = new Date(group.last_seen).getTime();

  // Newest first, each a few hours before the one above it.
  let at = lastSeen;
  const samples: ErrorSample[] = Array.from({ length: 5 }, (_, i) => ({
    id: `${fingerprint}-sample-${i + 1}`,
    message: group.message,
    stack: fault.stack,
    source_file: group.source_file,
    line_no: group.line_no,
    col_no: group.line_no == null ? null : Math.floor(5 + random() * 30),
    page_path: group.last_page_path,
    // Most occurrences were recorded; one shows the "No replay recorded" state.
    session_id: i === 3 ? null : `demo-session-${1 + Math.floor(random() * 25)}`,
    visitor_id: `visitor-${Math.floor(random() * 1000)}`,
    browser: BROWSERS[Math.floor(random() * BROWSERS.length)]!,
    os: OSES[Math.floor(random() * OSES.length)]!,
    device_type: DEVICES[Math.floor(random() * DEVICES.length)]!,
    occurred_at: new Date(i === 0 ? at : (at -= (2 + random() * 6) * HOUR)).toISOString(),
  }));

  return { group, samples };
}
