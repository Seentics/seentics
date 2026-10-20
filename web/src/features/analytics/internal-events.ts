/**
 * Event types the tracker records on its own, as opposed to events the site tracked.
 *
 * One list for every place that shows "your events". The overview and the Events page each
 * kept their own, and they disagreed: the overview hid scroll and exit events but listed
 * `performance` (web vitals, sent on every page) and `identify` (an identify() call) as if the
 * site had tracked them; the Events page did the reverse. Funnel progress is reported by the
 * tracker for the funnels it was given, so it is the tracker's too.
 */
export const INTERNAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'pageview',
  'page_view',
  'page_exit',
  'scroll_depth',
  'click',
  'session_start',
  'session_end',
  '__sn_heartbeat',
  '__sn_leave',
  'performance',
  'identify',
  'funnel_step',
  'funnel_complete',
]);

export const isInternalEvent = (eventType: string): boolean => INTERNAL_EVENT_TYPES.has(eventType);
