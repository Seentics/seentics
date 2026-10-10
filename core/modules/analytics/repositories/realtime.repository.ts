/** Window for the "active" count: visitors with a pageview in the last 30 minutes. */
export const REALTIME_WINDOW_MS = 30 * 60_000;

/**
 * Window for the "Live Visitors" badge — people with a pageview in the last five minutes.
 *
 * It was thirty seconds, but the tracker sends no heartbeat while a page is open, so the only
 * sign of a visitor is the pageview that opened it: someone reading for a minute was no longer
 * "live", and the badge dropped to zero between page loads on a site people read rather than
 * click through. Five minutes is the usual stand-in when presence cannot be observed.
 */
export const LIVE_VISITOR_WINDOW_MS = 5 * 60_000;
