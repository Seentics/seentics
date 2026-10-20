/**
 * The demo site's Conversions page: a connected Meta pixel, GA4 property, TikTok pixel and
 * LinkedIn ad account, and a month of
 * events sent to them. Seeded and dated against `DEMO_REFERENCE_DATE`, so the page reads the
 * same on every visit and in captures.
 *
 * Every event here came from a visitor who consented — the only kind Seentics ever queues —
 * so "skipped" is used for its one real meaning: a kind the destination does not send.
 */
import type {
  ConversionEvent, ConversionEventFilters, ConversionEventPage, ConversionSummary, Destination, EventKind, MatchKey, Platform,
} from '@/features/conversions/types';
import { DEFAULT_EVENTS, MATCH_KEYS } from '@/features/conversions/types';
import { createDemoRandom, DEMO_REFERENCE_DATE } from './fixture-utils';

const DAY = 86_400_000;
const NOW = DEMO_REFERENCE_DATE.getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const META_ID = 'demo-dest-meta';
const GA4_ID = 'demo-dest-ga4';
const TIKTOK_ID = 'demo-dest-tiktok';
const LINKEDIN_ID = 'demo-dest-linkedin';

const DESTINATIONS: Destination[] = [
  {
    id: META_ID,
    platform: 'meta',
    name: 'Meta pixel',
    enabled: true,
    status: 'active',
    last_error: null,
    credentials_hint: 'Pixel 1048…3921',
    config: { events: { ...DEFAULT_EVENTS.meta }, custom: [{ name: 'checkout_started', platform_event: 'InitiateCheckout' }], test_event_code: null },
    created_at: iso(NOW - 40 * DAY),
    updated_at: iso(NOW - 12 * DAY),
    stats: { sent_7d: 0, failed_7d: 0, last_sent_at: null },
  },
  {
    id: GA4_ID,
    platform: 'ga4',
    name: 'Google Analytics 4',
    enabled: true,
    status: 'active',
    last_error: null,
    credentials_hint: 'G-7QX2LM4K9P',
    // GA4 does not take leads here: those events show as skipped.
    config: { events: { ...DEFAULT_EVENTS.ga4, lead: null }, custom: [], test_event_code: null },
    created_at: iso(NOW - 33 * DAY),
    updated_at: iso(NOW - 33 * DAY),
    stats: { sent_7d: 0, failed_7d: 0, last_sent_at: null },
  },
  {
    id: TIKTOK_ID,
    platform: 'tiktok',
    name: 'TikTok pixel',
    enabled: true,
    status: 'active',
    last_error: null,
    credentials_hint: 'Pixel CQ7N…4KD0',
    config: { events: { ...DEFAULT_EVENTS.tiktok }, custom: [{ name: 'checkout_started', platform_event: 'InitiateCheckout' }], test_event_code: null },
    created_at: iso(NOW - 21 * DAY),
    updated_at: iso(NOW - 21 * DAY),
    stats: { sent_7d: 0, failed_7d: 0, last_sent_at: null },
  },
  {
    id: LINKEDIN_ID,
    platform: 'linkedin',
    name: 'LinkedIn Ads',
    enabled: true,
    status: 'active',
    last_error: null,
    credentials_hint: 'Ad account 512384907',
    // B2B: leads and sign-ups only, each to its own conversion rule.
    config: { events: { purchase: null, lead: '18427305', sign_up: '18427306' }, custom: [], test_event_code: null },
    created_at: iso(NOW - 14 * DAY),
    updated_at: iso(NOW - 14 * DAY),
    stats: { sent_7d: 0, failed_7d: 0, last_sent_at: null },
  },
];

/** The keys each platform matches by: LinkedIn takes only email and its own click id. */
const TAKES: Record<Platform, readonly MatchKey[]> = {
  meta: MATCH_KEYS,
  ga4: ['click_id', 'email', 'phone', 'browser_id'],
  tiktok: MATCH_KEYS,
  linkedin: ['click_id', 'email'],
};

const ERRORS: Record<Platform, string> = {
  meta: 'Invalid OAuth access token — the token was revoked or expired. Generate a new one in Events Manager.',
  ga4: 'Measurement Protocol rejected the event: api_secret does not match this data stream.',
  tiktok: 'Access token is incorrect or has been revoked. Generate a new one in Events Manager.',
  linkedin: 'The token has expired. Generate a new one with the rw_conversions scope.',
};

function platformEvent(dest: Destination, kind: EventKind, name: string): string | null {
  if (kind === 'custom') return dest.config.custom.find((c) => c.name === name)?.platform_event ?? null;
  return dest.config.events[kind];
}

function buildEvents(): ConversionEvent[] {
  const rnd = createDemoRandom('conversions');
  const out: ConversionEvent[] = [];
  let n = 0;
  for (let i = 0; i < 24; i += 1) {
    // Spread across 30 days, more recently busier.
    const at = NOW - Math.floor(Math.pow(rnd(), 1.4) * 30 * DAY) - Math.floor(rnd() * 3_600_000);
    const roll = rnd();
    const kind: EventKind = roll < 0.55 ? 'purchase' : roll < 0.78 ? 'lead' : roll < 0.92 ? 'sign_up' : 'custom';
    const name = kind === 'custom' ? 'checkout_started' : kind;
    const order = kind === 'purchase' ? `#${1000 + Math.floor(rnd() * 900)}` : null;
    const value = kind === 'purchase' ? Math.round((20 + rnd() * 160) * 100) / 100 : null;
    // IP and browser come with every server event; the _fbp/_ga id only where the site runs the pixel too.
    const keys: MatchKey[] = ['ip_ua'];
    if (rnd() < 0.55) keys.push('browser_id');
    if (rnd() < 0.72) keys.unshift('click_id');
    if (kind === 'lead' || kind === 'sign_up' || rnd() < 0.4) keys.splice(1, 0, 'email');
    if (kind === 'lead' && rnd() < 0.45) keys.splice(2, 0, 'phone');
    for (const dest of DESTINATIONS) {
      const event = platformEvent(dest, kind, name);
      const failed = event !== null && rnd() < 0.07;
      const pending = event !== null && !failed && at > NOW - 90_000;
      n += 1;
      out.push({
        id: `demo-conv-${n}`,
        destination_id: dest.id,
        platform: dest.platform,
        kind,
        event_name: name,
        platform_event: event ?? '—',
        status: event === null ? 'skipped' : failed ? 'failed' : pending ? 'pending' : 'success',
        error: event === null ? 'Not mapped: this destination does not send this event.' : failed ? ERRORS[dest.platform] : null,
        attempt_count: failed ? 6 : event === null ? 0 : 1,
        match_keys: event === null ? [] : MATCH_KEYS.filter((k) => keys.includes(k) && TAKES[dest.platform].includes(k)),
        value,
        currency: value === null ? null : 'USD',
        order_id: order,
        created_at: iso(at),
        completed_at: pending ? null : iso(at + 2_000 + Math.floor(rnd() * 8_000)),
      });
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const EVENTS = buildEvents();

/** The destinations, with their last-7-days figures worked out from the events. */
export function demoDestinations(): Destination[] {
  const weekAgo = NOW - 7 * DAY;
  return DESTINATIONS.map((d) => {
    const mine = EVENTS.filter((e) => e.destination_id === d.id && e.status !== 'skipped');
    const week = mine.filter((e) => Date.parse(e.created_at) >= weekAgo);
    const lastSent = mine.find((e) => e.status === 'success');
    return {
      ...d,
      stats: {
        sent_7d: week.filter((e) => e.status === 'success').length,
        failed_7d: week.filter((e) => e.status === 'failed').length,
        last_sent_at: lastSent?.completed_at ?? null,
      },
    };
  });
}

export function demoConversionEvents(f: ConversionEventFilters): ConversionEventPage {
  const matched = EVENTS.filter((e) =>
    (!f.destination || e.destination_id === f.destination) && (!f.status || e.status === f.status) && (!f.kind || e.kind === f.kind)
    && (!f.days || Date.parse(e.created_at) >= NOW - f.days * DAY)
    && (!f.search || [e.order_id ?? '', e.event_name, e.platform_event].some((v) => v.toLowerCase().includes(f.search!.toLowerCase()))));
  return { events: matched.slice(f.offset, f.offset + f.limit), total: matched.length };
}

export function demoConversionSummary(days: number): ConversionSummary {
  const since = NOW - days * DAY;
  const inRange = EVENTS.filter((e) => Date.parse(e.created_at) >= since);
  const sent = inRange.filter((e) => e.status !== 'skipped');
  const count = (s: ConversionEvent['status']) => inRange.filter((e) => e.status === s).length;

  const byDay = new Map<string, { accepted: number; failed: number }>();
  for (let t = since; t <= NOW; t += DAY) byDay.set(iso(t).slice(0, 10), { accepted: 0, failed: 0 });
  for (const e of sent) {
    const slot = byDay.get(e.created_at.slice(0, 10));
    if (!slot) continue;
    if (e.status === 'success') slot.accepted += 1;
    if (e.status === 'failed') slot.failed += 1;
  }

  const match = { total: sent.length } as ConversionSummary['match'];
  for (const k of MATCH_KEYS) match[k] = sent.filter((e) => e.match_keys.includes(k)).length;

  const kinds: EventKind[] = ['purchase', 'lead', 'sign_up', 'custom'];
  return {
    totals: { sent: sent.length, accepted: count('success'), failed: count('failed'), skipped: count('skipped'), pending: count('pending') },
    by_day: [...byDay].map(([day, v]) => ({ day, ...v })),
    match,
    by_kind: kinds.map((kind) => ({ kind, accepted: inRange.filter((e) => e.kind === kind && e.status === 'success').length })),
    value: (() => {
      const m = new Map<string, ConversionSummary['value'][number]>();
      for (const e of inRange) {
        if (e.status !== 'success' || e.value === null || !e.currency) continue;
        const key = `${e.platform}:${e.currency}`;
        const row = m.get(key) ?? { platform: e.platform, currency: e.currency, value: 0, count: 0 };
        row.value += e.value; row.count += 1;
        m.set(key, row);
      }
      return [...m.values()].sort((a, b) => b.value - a.value);
    })(),
  };
}
