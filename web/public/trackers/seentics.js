/*!
 * Seentics Tracker v2 — analytics, session recording, heatmaps, funnels & automations
 *
 * This file is the core every visitor loads: page views, events, funnels, sessions,
 * delivery, and the hooks the optional features attach to. The features themselves are
 * separate files, fetched only where they are used:
 *
 *   ext-heatmaps.js     click/scroll capture and layout snapshots   (heatmaps on)
 *   ext-automations.js  trigger listeners and on-page actions       (site has automations)
 *   ext-replay.js       console/network/error capture               (session is recorded)
 *   seentics-dom.min.js rrweb, the DOM recorder                     (session is recorded)
 *
 * They used to be one 45 KB bundle that every visitor downloaded and parsed, and whose
 * listeners (a mousemove handler, a once-a-second timer, scroll handlers reading layout)
 * every visitor ran, on sites that used none of it.
 */

// ─── Config from script tag ───────────────────────────────────────────────────

const script = document.currentScript;

/** Website UUID — same value as the dashboard project id (data-website-id). */
const websiteId = script?.getAttribute('data-website-id') ?? '';

/**
 * Strip trailing /api/v1 so COLLECT = origin + '/api/v1/tracker/collect' never
 * doubles the prefix when a customer sets data-api-host to their full API URL.
 */
function normalizeApiBase(raw) {
  let s = raw.trim().replace(/\/+$/, '');
  while (/\/api\/v1$/i.test(s)) {
    s = s.replace(/\/api\/v1$/i, '');
  }
  return s;
}

/**
 * Hosts that serve this script but not the API: Seentics Cloud's dashboard on Cloudflare
 * Pages. Their /api/v1/tracker/* was a Pages Function forwarding to the gateway, and on
 * that second hop Cloudflare reports the Function's own address as the client — one US
 * address for every visitor — so every visitor was located in the US: EU visitors were
 * recorded without the consent `consent_region` exists to ask for, and every country,
 * region and city report was wrong. The gateway answers trackers on any origin itself.
 */
const CLOUD_SCRIPT_HOSTS = ['seentics.com', 'www.seentics.com'];
const CLOUD_API = 'https://api.seentics.com';

/**
 * When `data-api-host` is omitted, derive the host from this script's own URL: a
 * self-hosted install serves /api/v1/... from the same host as the script, so
 * pageviews, heatmaps and session batches all hit the customer's own stack. Seentics
 * Cloud's script host sends to its API directly (above). Inline scripts (no src) use
 * the Cloud API too.
 */
function defaultApiHostFromScript() {
  const src = script?.src?.trim();
  if (!src) return CLOUD_API;
  try {
    const u = new URL(src);
    if (!u.host) return CLOUD_API;
    if (CLOUD_SCRIPT_HOSTS.includes(u.hostname.toLowerCase())) return CLOUD_API;
    return `${u.protocol}//${u.host}`;
  } catch {
    return CLOUD_API;
  }
}

const apiHost   = normalizeApiBase(script?.getAttribute('data-api-host') ?? defaultApiHostFromScript());
const autoTrack = script?.getAttribute('data-auto-track') !== 'false';
const domain    = window.location.hostname;

/**
 * Per-feature opt-outs for the two recording sidecars, set on the script tag.
 *
 *   data-capture-console="off"   stop overriding console.* entirely
 *   data-capture-network="off"   stop wrapping fetch / XMLHttpRequest entirely
 */
const captureConsoleAllowed = script?.getAttribute('data-capture-console') !== 'off';
const captureNetworkAllowed = script?.getAttribute('data-capture-network') !== 'off';

if (!websiteId) {
  console.warn(
    '[Seentics] data-website-id is missing or empty. ' +
    'Load the tracker with a plain <script src> tag (defer is fine, type="module" is ' +
    'not): it reads its own attributes as it runs.',
  );
}

/** A file next to this script — where the extensions and the DOM recorder live. */
const _scriptSrc = script?.src ?? '';
const siblingUrl = (file) => (_scriptSrc ? _scriptSrc.replace(/[^/?#]*\.js[^/]*$/, file) : '');

/**
 * The extension files this build ships with, content-hashed by the bundler
 * (bundle-trackers.cjs), e.g. `{ l: 'seentics-l.3f9a1c2b.min.js', ... }`. The hash is in
 * the file name so the files can be cached forever, and so this core only ever runs the
 * extensions it was built with: after a deploy, a page still holding the old core asks
 * for the old file and gets either it or nothing, never a newer one it doesn't fit.
 */
const EXTENSIONS = typeof __SNC_EXTENSIONS__ !== 'undefined' ? __SNC_EXTENSIONS__ : {};

// The DOM-recorder bundle; override via data-rrweb-src. Never named `rrweb.min.js`:
// privacy filter lists match that filename exactly, so the request was cancelled
// in-browser and replay silently never started. The content-hashed copy (`d`) is cached
// for good; under its fixed name it was revalidated on every page, a round trip between
// a page opening and its recording starting.
const rrwebSrc = script?.getAttribute('data-rrweb-src') ?? siblingUrl(EXTENSIONS.d ?? 'seentics-dom.min.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECT        = apiHost + '/api/v1/tracker/collect';
const FLUSH_MS       = 5_000;           // periodic flush interval (5 s — shorter window reduces unload data on mobile)
const SESSION_MAX_MS = 30 * 60 * 1000; // hard session cap (30 min)
const DELIVERY_RETRY_MAX = 4;
const DELIVERY_RETRY_TTL_MS = 2 * 60_000;
const DELIVERY_RETRY_QUEUE_MAX = 12;

// ─── Runtime state ────────────────────────────────────────────────────────────

/**
 * When the current page view began.
 *
 * Reset on SPA navigation, so `timeOnPage` measures the view rather than the tab's
 * lifetime — a condition like "waited 30s on this page" means the page they are on.
 */
let pageEnterMs = Date.now();

/** Where and when this document opened, before any SPA route change. */
const documentHref = location.href;
const documentStartMs = Date.now();
/** Whether the recorder has accounted for this document's opening page (startRrweb). */
let recordedDocumentStart = false;

/** Config, funnels, and automations loaded from /tracker/init on boot. */
let cfg         = {};
let funnels     = [];
let automations = [];
let flushInterval = null;

/** True once /tracker/init has answered (or failed) and tracking has started or been declined. */
let started = false;

// ─── Consent ──────────────────────────────────────────────────────────────────
//
// A site's `consent_mode` decides what happens before a visitor consents:
//   cookieless (default)  where the law asks for consent (the EU/EEA, the UK and
//                         Switzerland — `consent_region`, decided by the server from the
//                         visitor's country, and assumed when it is unknown): anonymous
//                         page views, events, funnels, errors and heatmap clicks and
//                         scrolls, with no id and nothing stored in the browser; the
//                         server counts visitors with a daily-rotating hash. The
//                         persistent id, recordings, layout snapshots, automations and
//                         identify() wait for consent. Everywhere else: everything, as
//                         with `none`.
//   strict                nothing at all until consent.
//   none                  no consent asked: everything, for every visitor (the site
//                         owner has another legal basis).
// Consent arrives as `data-consent="granted"`, `window.seenticsConsent = true`, or —
// from a consent banner at any time — `seentics.consent(true | false)`.

/** Where the visitor's own consent choice is kept: a record of consent, not tracking. */
const CONSENT_KEY = 'snc_consent';
/** Set by `seentics.consent()`; null until the page has said anything this visit. */
let runtimeConsent = null;

const consentGranted = () => {
  if (runtimeConsent !== null) return runtimeConsent;
  if (script?.getAttribute('data-consent') === 'granted' || window.seenticsConsent === true) return true;
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
};

const trackingAllowed = (config = cfg) => {
  if (config.respect_dnt === true && navigator.doNotTrack === '1') return false;
  return config.consent_mode !== 'strict' || consentGranted();
};

/**
 * The configuration this page acts on: the site's, once /tracker/init has answered;
 * before that, the one the last visit cached (only ever written for an identified
 * visitor), or none.
 */
let assumedConfig = null;
const effectiveConfig = () => (started ? cfg : assumedConfig);

/**
 * May this visitor be identified — an id stored in their browser, their session
 * recorded, their clicks mapped, automations run, identify() kept?
 *
 * Without a known configuration only an explicit consent says yes: the safe answer
 * before /tracker/init has answered is the anonymous one.
 */
const identified = () => {
  const config = effectiveConfig();
  if (!config) return consentGranted();
  if (!trackingAllowed(config)) return false;
  return consentGranted() || config.consent_mode === 'none' || outsideConsentRegion(config);
};

/** A visitor the law does not ask consent for: only `consent_region: false` says so. */
const outsideConsentRegion = (config) => config.consent_mode === 'cookieless' && config.consent_region === false;

/**
 * The set of trigger types any loaded automation listens for.
 *
 * Built once when automations load so the hot path — every click, every scroll
 * threshold, every visibility change — answers "is anything listening?" with one Set
 * lookup instead of scanning every automation's every trigger on every event.
 */
let automationTriggerTypes = new Set();

/**
 * Triggers with an evaluate request already in flight, keyed by type and the value that
 * distinguishes one event of a type from another (depth, seconds, selector, name).
 */
const automationInFlight = new Set();

/**
 * True only while rrweb is actively recording a session that was sampled in.
 * Console / network / error capture is gated on this so we never ship session
 * annotation events that have no replay to attach to (sampled-out visitors).
 */
let sessionCaptureActive = false;

/**
 * In-memory queues for each event category.
 * All queues are drained together into a single /collect POST every FLUSH_MS.
 */
const queues = {
  events:               [], // pageviews, custom events, performance, identify
  funnels:              [], // funnel_step, funnel_complete
  automations:          [], // automation_trigger
  session:              [], // rrweb eventWithTime wrapped in a TrackerEvent envelope
  heatmaps:             [], // heatmap_click, heatmap_scroll
  heatmap_dom_snapshot: [], // full DOM HTML snapshots (heatmap backgrounds)
  errors:               [], // uncaught JS errors and unhandled promise rejections
};

/**
 * Approximate size of the queued recording (DOM mutations measured, other events
 * estimated), and the size at which it is flushed ahead of the periodic flush — well
 * under the ~64 KB a closing page may still send.
 */
const SESSION_EARLY_FLUSH_BYTES = 24_000;
let sessionQueueBytes = 0;
let sessionEarlyFlushScheduled = false;

// ─── Visitor / Session IDs ────────────────────────────────────────────────────

/**
 * Storage that never throws. Reads *and writes* are guarded: a write can throw where a
 * read succeeds (quota exhausted, Safari's private mode on older versions), and an
 * unguarded write here used to throw out of the tracker's first statement — no visitor
 * id, so no tracking at all for that visitor, and an error in the host page's console.
 */
const rawGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const rawSet = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };

/**
 * The browser's storage, for an identified visitor only. An anonymous visitor's
 * browser is neither read nor written — EU law treats localStorage exactly like
 * cookies, so "cookie-free" was not enough on its own: the visitor id it kept for ever
 * needed consent like any cookie would.
 */
const storeGet = (key) => (identified() ? rawGet(key) : null);
const storeSet = (key, value) => (identified() ? rawSet(key, value) : false);

/** Cryptographically random token; falls back to Math.random if the crypto API is unavailable. */
const rnd = () => {
  try {
    const arr = new Uint8Array(9);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(36)).join('');
  } catch {
    return Math.random().toString(36).slice(2, 11);
  }
};

/**
 * The visitor's id: persistent for an identified visitor, `anon` otherwise — the
 * server replaces `anon` with the day's anonymous hash.
 */
const ANON = 'anon';
let _visitorId = null;
const getVisitorId = () => {
  if (!identified()) return ANON;
  if (_visitorId) return _visitorId;
  let id = storeGet('snc_vid');
  if (!id) {
    id = 'v-' + rnd() + Date.now().toString(36);
    storeSet('snc_vid', id);
  }
  return (_visitorId = id);
};

/**
 * In-memory session ID cache.
 * Without caching, getSessionId() would perform 3 synchronous localStorage ops on
 * every pushAnalytics() call. With caching, storage is only re-read after genuine
 * inactivity (when the in-memory expiry has lapsed), and the expiry write is
 * throttled to once per minute while the session is active.
 */
let _cachedSid       = null;
let _cachedSidExpiry = 0;  // absolute ms at which the cached sid should be considered expired
let _cachedSidStart  = 0;  // session start ms — needed to enforce the hard cap on the fast path
let _lastExpiryWrite = 0;  // last time we wrote snc_se to storage

const getSessionId = () => {
  if (!identified()) return ANON;
  const now = Date.now();

  // Fast path: in-memory cache is still warm AND the hard cap hasn't been hit.
  // Without the hard-cap check here, an always-active tab keeps sliding the
  // expiry forward and the 30-min cap is never enforced.
  if (_cachedSid && now < _cachedSidExpiry && (now - _cachedSidStart) < SESSION_MAX_MS) {
    // Throttle the storage write to once per minute.
    // Other tabs can observe activity at minute granularity; no write on every event.
    if (now - _lastExpiryWrite > 60_000) {
      _lastExpiryWrite = now;
      _cachedSidExpiry = now + SESSION_MAX_MS;
      storeSet('snc_se', String(_cachedSidExpiry));
    }
    return _cachedSid;
  }

  // Cache miss — fall back to storage (first call, or after genuine inactivity).
  let id        = storeGet('snc_sid');
  const expiry  = storeGet('snc_se');   // inactivity expiry timestamp
  let   started = storeGet('snc_ss');   // session start time (for hard cap)

  const inactivityExpired = !id || !expiry || now > +expiry;
  const hardCapExceeded   = !!started && (now - +started) >= SESSION_MAX_MS;

  if (inactivityExpired || hardCapExceeded) {
    // Without working storage this still gives one stable session per page lifetime
    // (until the cap or inactivity), instead of a new id on every event.
    id = 's-' + rnd() + now.toString(36);
    started = String(now);
    storeSet('snc_sid', id);
    storeSet('snc_ss', started);
  }

  _cachedSidExpiry = now + SESSION_MAX_MS;
  storeSet('snc_se', String(_cachedSidExpiry));
  _cachedSid       = id;
  _cachedSidStart  = started ? +started : now;
  _lastExpiryWrite = now;
  return id;
};

// Keep the in-memory session cache in sync when another tab rotates the session,
// so concurrent tabs don't report overlapping/stale session IDs for up to 30 min.
try {
  window.addEventListener('storage', (e) => {
    if (e.key === 'snc_sid' && e.newValue && e.newValue !== _cachedSid) {
      _cachedSid       = e.newValue;
      _cachedSidStart  = +(storeGet('snc_ss') ?? Date.now()) || Date.now();
      _cachedSidExpiry = Date.now() + SESSION_MAX_MS;
    }
  });
} catch { /* ignore */ }

// ─── Queue helpers ────────────────────────────────────────────────────────────

/** Map an event type string to its queue key. */
const categoryOf = (type) => {
  if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
  if (type === 'automation_trigger')                        return 'automations';
  return 'events';
};

/**
 * Push a typed analytics event onto the appropriate queue.
 *
 * Before /tracker/init has answered, the visitor's ids are left for the flush to fill
 * in (`withIds`): whether they may be identified is not known yet.
 */
const pushAnalytics = (type, data) => {
  queues[categoryOf(type)].push({
    type,
    data,
    ts:  Date.now(),
    url: location.href,
    ...(started ? { sid: getSessionId(), vid: getVisitorId() } : {}),
  });
};

/** Give queued items queued before the visitor's status was known their ids now. */
const withIds = (items) => {
  for (const item of items) {
    if (item.vid === undefined) item.vid = getVisitorId();
    if (!item.sid) item.sid = getSessionId();
  }
  return items;
};

// ─── Network transport ────────────────────────────────────────────────────────

/**
 * Send JSON (optionally gzip-compressed) via XHR.
 * Used for large payloads (session recording, big heatmap batches) where sendBeacon's
 * ~64 KB limit would be exceeded.
 */
const sendXhr = (body, encoding = '') => new Promise((resolve) => {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', COLLECT, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (encoding) xhr.setRequestHeader('Content-Encoding', encoding);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 400);
    xhr.onerror = () => resolve(false);
    xhr.ontimeout = () => resolve(false);
    xhr.timeout = 15_000;
    xhr.send(body);
  } catch { resolve(false); }
});

/**
 * Below this a batch goes out as a keepalive fetch: sent at once, uncompressed, and
 * finished by the browser even if the page unloads mid-request. Kept under the 64 KB
 * keepalive body cap browsers enforce.
 */
const KEEPALIVE_MAX_BYTES = 60_000;

const sendKeepalive = (json) => {
  try {
    // Retried only when the server answered with a retryable failure. A keepalive
    // request outlives the page by design, so a rejected promise — the document moving
    // on while the request is in flight — does not mean it was lost; retrying on that
    // stored the same batch twice (duplicate pageviews and events).
    return fetch(COLLECT, {
      method: 'POST',
      body: json,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).then(r => !(r.status >= 500 || r.status === 429), () => true);
  } catch {
    // Over the browser's in-flight keepalive quota: an ordinary request instead.
    return sendXhr(json);
  }
};

/**
 * Large batches still being compressed. Compression is asynchronous, so a batch drained
 * just before the visitor leaves would otherwise be lost with the page: `flushBeacon`
 * takes these over (`handedOff`) and the compressed send is skipped.
 */
const compressingDeliveries = new Set();

const sendGzip = async (item) => {
  if (typeof CompressionStream !== 'undefined') {
    compressingDeliveries.add(item);
    let buf = null;
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(new TextEncoder().encode(item.json));
      writer.close();
      buf = await new Response(cs.readable).arrayBuffer();
    } catch (_) {
      /* fall through to plain JSON */
    }
    // Out of the set before the request goes out, not when its response comes back: a
    // batch already on the wire that the unload flush also took over arrived twice.
    compressingDeliveries.delete(item);
    if (item.handedOff) return true;
    if (buf) return await sendXhr(buf, 'gzip');
  }
  return await sendXhr(item.json);
};

const deliveryRetryQueue = [];

const queueDeliveryRetry = (item) => {
  if (item.attempt >= DELIVERY_RETRY_MAX || Date.now() - item.createdAt > DELIVERY_RETRY_TTL_MS) return;
  item.nextAt = Date.now() + Math.min(30_000, 1_000 * (2 ** item.attempt));
  if (deliveryRetryQueue.length >= DELIVERY_RETRY_QUEUE_MAX) deliveryRetryQueue.shift();
  deliveryRetryQueue.push(item);
};

/**
 * Send one drained batch, retrying acknowledged failures.
 *
 * Small batches — nearly every session-recording flush — use a keepalive fetch. They used
 * to be gzipped first and sent by XHR: compression is asynchronous and a navigation
 * aborts an ordinary XHR, so whatever the visitor did in the last moments on a page (the
 * click that submitted the form, the confirmation it produced) was drained from the
 * queues, then dropped with the page, and the unload flush found nothing left to send.
 */
const dispatchWithRetry = (item) => {
  const send = item.json.length <= KEEPALIVE_MAX_BYTES
    ? sendKeepalive(item.json)
    : item.gzip ? sendGzip(item) : sendXhr(item.json);
  Promise.resolve(send).then(ok => {
    if (!ok) queueDeliveryRetry({ ...item, attempt: item.attempt + 1 });
  }).catch(() => queueDeliveryRetry({ ...item, attempt: item.attempt + 1 }));
};

const retryFailedDeliveries = () => {
  const now = Date.now();
  for (let i = deliveryRetryQueue.length - 1; i >= 0; i--) {
    const item = deliveryRetryQueue[i];
    if (item.nextAt > now) continue;
    deliveryRetryQueue.splice(i, 1);
    dispatchWithRetry(item);
  }
};

/**
 * Build the /collect payload from all non-empty queues and return {payload, json}.
 * Returns null when all queues are empty (nothing to send).
 *
 * On a site whose policy declines this visitor (strict consent without a signal, Do Not
 * Track), queued data is discarded rather than sent. Nothing used to stop it: the page's
 * own `seentics.track()` calls and any reported errors queued as usual, and the unload
 * flush — installed before the policy was known — sent them when the visitor left.
 */
const drainQueues = () => {
  if (started && !trackingAllowed()) {
    for (const key in queues) queues[key].length = 0;
    sessionQueueBytes = 0;
    return null;
  }

  const events          = withIds(queues.events.splice(0));
  const funnelEvts      = withIds(queues.funnels.splice(0));
  const autoEvts        = withIds(queues.automations.splice(0));
  const sessionEvts     = queues.session.splice(0);
  sessionQueueBytes = 0;
  const heatmapEvts     = queues.heatmaps.splice(0);
  const domSnapshotEvts = queues.heatmap_dom_snapshot.splice(0);
  const errorEvts       = withIds(queues.errors.splice(0));

  if (!events.length && !funnelEvts.length && !autoEvts.length && !sessionEvts.length && !heatmapEvts.length && !domSnapshotEvts.length && !errorEvts.length) {
    return null;
  }

  // `anonymous`: these ids are placeholders, whatever the site's mode — the server then
  // gives the batch the day's anonymous id and keeps only what needs no consent.
  const payload = { website_id: websiteId, domain, ua: navigator.userAgent, consent: consentGranted(), anonymous: !identified() };
  if (events.length)            payload.events               = events;
  if (funnelEvts.length)        payload.funnels              = funnelEvts;
  if (autoEvts.length)          payload.automations          = autoEvts;
  if (sessionEvts.length)       payload.session              = sessionEvts;
  if (heatmapEvts.length)       payload.heatmaps             = heatmapEvts;
  if (domSnapshotEvts.length)   payload.heatmap_dom_snapshot = domSnapshotEvts;
  if (errorEvts.length)         payload.errors               = errorEvts;

  return { payload, json: JSON.stringify(payload), sessionEvts, heatmapEvts, domSnapshotEvts };
};

// ─── Flush functions ──────────────────────────────────────────────────────────

/**
 * Periodic flush — drains all queues and sends to /collect.
 * Also restarts rrweb if the session ID rotated since recording began
 * (so the new session gets a fresh FullSnapshot baseline).
 */
const flush = () => {
  retryFailedDeliveries();
  // Restart rrweb if the session rotated (inactivity or hard cap hit).
  if (activeRecordingSessionId !== null) {
    const currentSid = getSessionId();
    if (currentSid !== activeRecordingSessionId) {
      loadRrweb().then(record => {
        if (record) startRrweb(record, currentSid, computeReplaySessionEnabled());
      });
    }
  }

  const drained = drainQueues();
  if (!drained) return;
  const { json, sessionEvts, heatmapEvts, domSnapshotEvts } = drained;

  // Session recording, layout snapshots, or large batches: acknowledged delivery with
  // retry (keepalive fetch when small, gzipped XHR when large — see dispatchWithRetry).
  if (sessionEvts.length > 0 || domSnapshotEvts.length > 0 || heatmapEvts.length > 400 || json.length > 55_000) {
    dispatchWithRetry({ json, gzip: true, attempt: 0, createdAt: Date.now(), nextAt: 0 });
    return;
  }

  // Analytics-only payload: sendBeacon is fire-and-forget and survives page navigation.
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon(COLLECT, blob)) return;

  // sendBeacon rejected or unavailable: retry acknowledged XHR failures with the
  // exact same JSON. Stable content keeps the server's batch-id dedupe effective.
  dispatchWithRetry({ json, gzip: false, attempt: 0, createdAt: Date.now(), nextAt: 0 });
};

/**
 * Unload flush — called on visibilitychange:hidden and pagehide.
 * Must use keepalive fetch (or sendBeacon) because the page is closing.
 * Synchronous XHR is deprecated in Chrome 80+ and silently dropped during unload.
 */
const flushBeacon = () => {
  // Batches already drained but not yet on the wire would die with the page: those
  // still being compressed, and those waiting to retry. They leave with this flush.
  const payloads = [];
  for (const item of compressingDeliveries) {
    item.handedOff = true;
    try { payloads.push(JSON.parse(item.json)); } catch { /* unreachable: we serialized it */ }
  }
  compressingDeliveries.clear();
  for (const item of deliveryRetryQueue.splice(0)) {
    try { payloads.push(JSON.parse(item.json)); } catch { /* unreachable */ }
  }
  const drained = drainQueues();
  if (drained) payloads.push(drained.payload);
  if (!payloads.length) return;

  // Browsers cap the bytes a closing page may have in flight (about 64 KB, per request
  // and in total), so what leaves is split by value, most valuable first. One request
  // used to carry everything: when a burst of activity just before leaving (a grid
  // re-rendered, a list expanded) made the recording part large, the whole request was
  // refused and the page's analytics events and heatmap clicks went down with it.
  const parts = payloads.map(unloadParts);
  for (const p of parts) if (p.core) sendOnUnload(p.core);
  for (const p of parts) for (const json of p.heatmaps) sendOnUnload(json);
  for (const p of parts) for (const json of p.session) sendOnUnload(json);
  for (const p of parts) for (const json of p.snapshots) sendOnUnload(json);
};

/** Largest single request sent while the page closes; under the ~64 KB keepalive cap. */
const UNLOAD_PART_MAX = 60_000;
/** Recording pieces at unload: small, because the cap is on the total in flight too. */
const UNLOAD_SESSION_PIECE = 16_000;

/**
 * One drained payload as unload-sized requests: `core` (analytics events, funnels,
 * automations, errors — small, and what a page view is worth), heatmap points, the
 * recording, then page snapshots. Every group is cut into requests that each fit: a busy
 * page queues a kilobyte per click, and one oversized request loses all of them.
 */
const unloadParts = (payload) => {
  const { session, heatmaps, heatmap_dom_snapshot: doms, ...rest } = payload;
  const envelope = { website_id: payload.website_id, domain: payload.domain, ua: payload.ua, consent: payload.consent };
  const hasCore = Object.values(rest).some(v => Array.isArray(v) && v.length > 0);
  const inPieces = (key, items, max = UNLOAD_PART_MAX) => {
    const pieces = [];
    let chunk = [];
    let size = 0;
    for (const item of items ?? []) {
      const n = JSON.stringify(item).length;
      if (chunk.length && size + n > max) {
        pieces.push(JSON.stringify({ ...envelope, [key]: chunk }));
        chunk = [];
        size = 0;
      }
      chunk.push(item);
      size += n;
    }
    if (chunk.length) pieces.push(JSON.stringify({ ...envelope, [key]: chunk }));
    return pieces;
  };
  return {
    core: hasCore ? JSON.stringify(rest) : null,
    heatmaps: inPieces('heatmaps', heatmaps),
    // Small pieces: what is left of the closing page's budget after the analytics and
    // heatmap parts is filled with as much of the recording as fits, in order.
    session: inPieces('session', session, UNLOAD_SESSION_PIECE),
    snapshots: (doms ?? []).map(item => JSON.stringify({ ...envelope, heatmap_dom_snapshot: [item] })),
  };
};

/** One request that must survive the page closing: sendBeacon, falling back to keepalive fetch. */
const sendOnUnload = (json) => {
  if (json.length <= UNLOAD_PART_MAX) {
    const blob = new Blob([json], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon(COLLECT, blob)) return;
  }
  try {
    fetch(COLLECT, {
      method: 'POST',
      body: json,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  } catch { /* ignore — page is already closing */ }
};

// ─── Extensions ───────────────────────────────────────────────────────────────

/** Run `fn`, swallowing what it throws: one feature failing must not stop the rest. */
const safely = (fn) => { try { return fn(); } catch { return undefined; } };

/**
 * What an extension sees of the core. Getters, so an extension always reads the current
 * value (config after init, the page view now, whether rrweb is running) rather than a
 * copy taken when it loaded.
 */
const extensionApi = {
  websiteId,
  COLLECT,
  queues,
  rnd,
  flush,
  getSessionId,
  pushAnalytics,
  urlAllowed: (include, exclude) => urlAllowed(include, exclude),
  textMaskedHere: () => textMaskedHere(),
  fireAutomationTrigger: (type, data) => fireAutomationTrigger(type, data),
  funnelsInProgress: () => funnelsInProgress(),
  get cfg() { return cfg; },
  get automations() { return automations; },
  get automationTriggerTypes() { return automationTriggerTypes; },
  get pageEnterMs() { return pageEnterMs; },
  get visitorId() { return getVisitorId(); },
  /** Whether this visitor may be identified; extensions stand down when not. */
  get identified() { return identified(); },
  /**
   * Whether heatmap clicks and scrolls may be captured: for any visitor this page tracks.
   * They are anonymous — a position on a page, under the day's hash — so a visitor who
   * has not consented contributes them too; the layout snapshot, a picture of what the
   * visitor saw, still waits for `identified`.
   */
  get heatmapsAllowed() { return started && trackingAllowed(); },
  get recording() { return stopRecording != null; },
  get recordingSessionId() { return activeRecordingSessionId; },
  get captureActive() { return sessionCaptureActive; },
};

const extensionLoads = {};

/**
 * Fetch an extension once and start it. Resolves to its interface, or null when it is
 * not part of this build, is blocked, or fails — callers treat null as "feature off".
 */
const loadExt = (key) => {
  if (extensionLoads[key]) return extensionLoads[key];
  extensionLoads[key] = new Promise((resolve) => {
    const file = EXTENSIONS[key];
    const startIt = () => {
      const factory = window.__sncx?.[file];
      resolve(factory ? safely(() => factory(extensionApi)) ?? null : null);
    };
    if (!file) { resolve(null); return; }
    // Another tracker on this page (same build) already loaded it.
    if (window.__sncx?.[file]) { startIt(); return; }
    const src = siblingUrl(file);
    if (!src) { resolve(null); return; }
    const tag = document.createElement('script');
    tag.src = src;
    tag.async = true;
    tag.onload = startIt;
    tag.onerror = () => resolve(null);
    (document.head || document.documentElement).appendChild(tag);
  });
  return extensionLoads[key];
};

/** The heatmap extension once loaded — page views and navigation are reported to it. */
let heat = null;

// ─── URL rules (recording/heatmap include/exclude) ────────────────────────────

/**
 * Test a regex pattern against a subject string.
 * Patterns longer than 500 chars fall back to plain string.includes to guard
 * against ReDoS attacks from malicious pattern data coming from the server.
 */
const safeRegex = (pattern, subject) => {
  if (pattern.length > 500) return subject.includes(pattern);
  try { return new RegExp(pattern).test(subject); }
  catch { return subject.includes(pattern); }
};

/** Split a newline-delimited pattern string into trimmed, non-empty lines. */
const patternLines = (patterns) => {
  if (!patterns) return [];
  return patterns.split('\n').map(p => p.trim()).filter(Boolean);
};

/** The current URL passes an include list (when there is one) and misses the exclude list. */
const urlAllowed = (include, exclude) => {
  const inc = patternLines(include);
  if (inc.length && !inc.some(p => safeRegex(p, location.href))) return false;
  const exc = patternLines(exclude);
  if (exc.length && exc.some(p => safeRegex(p, location.href))) return false;
  return true;
};

// ─── Session recording ────────────────────────────────────────────────────────

// rrweb is loaded on demand — only when this session is recorded.
// After loading, rrweb sets window.__rrweb_record = record.
let _rrwebLoadPromise = null;

/**
 * Inject the DOM-recorder bundle into the page once and return the record function.
 * Subsequent calls return the same promise (guaranteed single load).
 */
const loadRrweb = () => {
  if (_rrwebLoadPromise) return _rrwebLoadPromise;
  _rrwebLoadPromise = new Promise((resolve) => {
    if (window.__rrweb_record) { resolve(window.__rrweb_record); return; }
    if (!rrwebSrc)              { resolve(null); return; }
    const tag   = document.createElement('script');
    tag.src     = rrwebSrc;
    tag.async   = true;
    tag.onload  = () => resolve(window.__rrweb_record ?? null);
    tag.onerror = () => resolve(null);
    (document.head || document.documentElement).appendChild(tag);
  });
  return _rrwebLoadPromise;
};

/** Stop function returned by rrweb record(); null when recording is off. */
let stopRecording = null;
/** Session ID that the active rrweb instance is recording under. */
let activeRecordingSessionId = null;

/** Text that is always masked, on every site and page: editors and anything marked. */
const SENSITIVE_TEXT = '[contenteditable]:not([contenteditable="false"]), [data-seentics-mask], [data-seentics-mask] *, [data-sensitive], [data-sensitive] *';

/**
 * Does the site mask all page text where the visitor is now? Everywhere with
 * `mask_all_text`, or on the pages `mask_text_patterns` matches — an account page shows
 * a visitor's name and address in ordinary text, which input masking never reached.
 * Read at each text node rather than once, so a single-page app that routes onto
 * /account is masked from that moment, and the config /tracker/init returns applies
 * as soon as it arrives.
 */
const textMaskedHere = () => {
  const config = effectiveConfig() || {};
  if (config.mask_all_text === true) return true;
  const patterns = patternLines(config.mask_text_patterns);
  return patterns.length > 0 && patterns.some(p => safeRegex(p, location.href));
};

/** Same length, whitespace kept, so the replay's layout matches the page. */
const maskText = (text) => text.replace(/\S/g, '*');

/**
 * rrweb record() options.
 * Tuned for bandwidth efficiency: higher sampling intervals, no canvas / font / inline-CSS capture.
 */
const RRWEB_OPTIONS = {
  // As soon as the document is parsed. The recording is a DOM, with stylesheets and
  // images kept as URLs, so nothing it needs arrives at `load` — and waiting for `load`
  // lost whatever a visitor did while a page's images, fonts and ads were still coming in.
  recordAfter:      'DOMContentLoaded',
  checkoutEveryNms: 60_000, // full DOM snapshot every 60 s — shorter helps mobile tab resume recovery
  maskAllInputs:    true,
  /**
   * `maskAllInputs` covers <input>, <textarea> and <select> — not `contenteditable`,
   * which is what every rich-text editor, comment box and in-app chat widget uses. The
   * promise this product makes is that typed input never leaves the browser, so the
   * editors have to be covered too. `data-seentics-mask` is the opt-in for anything
   * else that should render as asterisks rather than be blocked outright.
   *
   * Every text node is offered for masking, and `maskTextFn` decides: the sensitive
   * elements always, everything else on pages the site masks in full. rrweb fixes the
   * selector when recording starts, and whether a page is masked can change after that.
   */
  maskTextSelector: '*',
  maskTextFn: (text, element) =>
    textMaskedHere() || (element && element.closest && element.closest(SENSITIVE_TEXT)) ? maskText(text) : text,
  blockSelector:    '[data-seentics-block], [data-private], [autocomplete="cc-number"]',
  ignoreSelector:   '[data-seentics-ignore]',
  recordShadowDOM:  true,
  sampling: {
    mousemove:  100,    // sample every 100 ms (rrweb default is 50 ms)
    touchmove:  100,    // mobile: throttle touchmove (default is every event — floods queue on scroll)
    scroll:     150,
    media:      800,
    input:      'last', // only send the final input value, not every keystroke
  },
  inlineStylesheet: false, // send stylesheet URLs, not the full CSS text
  collectFonts:     false, // skip base64-embedded fonts (can be several MB per snapshot)
  recordCanvas:     false, // skip canvas frame capture (charts, maps, etc. are too large)
  errorHandler:     (_err) => { /* keep the emit pipeline alive on bad DOM mutations */ },
};

/**
 * Is session recording switched on for this site?
 *
 * Fails closed. This used to read `replay_enabled !== false`, which treats an absent
 * field as consent: a config response that omitted it — a partial payload, a renamed
 * column, an older core — silently started recording every visitor on a site where the
 * feature was off. `/tracker/init` always sends the flag, so requiring it costs nothing.
 *
 * `cfg.recording` stays as an explicit server-side kill switch layered on top.
 */
const replayEnabledForSite = (config = cfg) => config.replay_enabled === true && config.recording !== false;

/**
 * Whether this session is sampled in — decided once per session and remembered.
 *
 * It used to be rolled again on every page load, so at a 50% sampling rate a session's
 * pages were recorded at random: replays with holes in them, and sessions counted as
 * recorded that held a fraction of the visit.
 */
const SAMPLING_DECISION_KEY = 'snc_rd';
const sessionSampledIn = (config) => {
  const sid = getSessionId();
  const saved = storeGet(SAMPLING_DECISION_KEY);
  if (saved && saved.slice(0, saved.lastIndexOf(':')) === sid) return saved.endsWith(':1');
  const rate = typeof config.replay_sampling_rate === 'number' ? config.replay_sampling_rate : 1.0;
  const sampledIn = rate >= 1 || Math.random() < rate;
  storeSet(SAMPLING_DECISION_KEY, `${sid}:${sampledIn ? 1 : 0}`);
  return sampledIn;
};

/** Returns true when this visitor's session should be shipped as session recording rows. */
const computeReplaySessionEnabled = (config = cfg) => {
  if (!replayEnabledForSite(config)) return false;
  if (!sessionSampledIn(config)) return false;
  return urlAllowed(config.replay_include_patterns, config.replay_exclude_patterns);
};

/**
 * The site's configuration as the last /tracker/init gave it, kept so the next page can
 * start recording without waiting for the network. See `startRecordingEarly`.
 */
const CONFIG_CACHE_KEY = `snc_cfg:${websiteId}`;
const cachedConfig = () => {
  // Read before it is known whether this visitor may be identified: it is the site's
  // configuration, not the visitor's, and it is only ever written for one who may be.
  try { return JSON.parse(rawGet(CONFIG_CACHE_KEY) ?? 'null'); } catch { return null; }
};

/**
 * Start (or restart) rrweb under the given session ID.
 * Restarts are needed when the session ID rotates (inactivity / hard cap) so the
 * new session begins with a fresh FullSnapshot rather than an orphaned incremental stream.
 */
const startRrweb = (record, sessionId, shouldRecordSession) => {
  if (stopRecording) {
    safely(stopRecording);
    stopRecording = null;
  }
  activeRecordingSessionId = sessionId;
  sessionCaptureActive     = shouldRecordSession;
  // The page this document opened at, if a SPA route change has moved off it before the
  // recorder got going. rrweb labels its first snapshot with the address at that moment,
  // so a visitor who landed on /app and was routed (or clicked) on within the first few
  // milliseconds appeared in the replay never to have been on /app at all. The page
  // marker rrweb itself would have written is added, at the time the page opened.
  if (shouldRecordSession && !recordedDocumentStart && location.href !== documentHref) {
    queues.session.push({
      type: 'rrweb',
      data: { type: 4 /* Meta */, data: { href: documentHref, width: innerWidth, height: innerHeight }, timestamp: documentStartMs },
      ts:   documentStartMs,
      url:  documentHref,
      sid:  sessionId,
      vid:  getVisitorId(),
    });
  }
  recordedDocumentStart = true;
  const stop = record({
    ...RRWEB_OPTIONS,
    emit(event) {
      // Always mirror into heatmaps (click positions, scroll depth).
      if (heat) safely(() => heat.mirror(event));
      // Only queue the raw rrweb event for replay if this session is sampled in.
      if (!shouldRecordSession) return;
      queues.session.push({
        type: 'rrweb',
        data: event,
        ts:   event.timestamp,
        url:  location.href,
        sid:  activeRecordingSessionId,
        vid:  getVisitorId(),
      });
      // Full snapshots (type 2) can be 50–200 KB. Flush immediately so the data
      // is already sent before the user navigates away — iOS Safari's keepalive
      // fetch hard-cap of 64 KB would otherwise silently drop it on pagehide.
      if (event.type === 2 /* FullSnapshot */) {
        setTimeout(flush, 0);
        return;
      }
      // The same cap applies to everything a closing page sends, in total. A burst
      // of DOM changes (a grid re-rendered by a filter, a "load more") can queue far
      // more than that in a second; left for the periodic flush, a visitor who moves
      // on straight away took all of it with them. Past a threshold, send now.
      sessionQueueBytes += event.type === 3 && event.data?.source === 0
        ? JSON.stringify(event).length
        : 200;
      if (sessionQueueBytes > SESSION_EARLY_FLUSH_BYTES && !sessionEarlyFlushScheduled) {
        sessionEarlyFlushScheduled = true;
        setTimeout(() => { sessionEarlyFlushScheduled = false; flush(); }, 0);
      }
    },
  });
  if (typeof stop === 'function') stopRecording = stop;
};

/**
 * Start recording, if this visitor is being recorded at all.
 *
 * The console and network sidecars (ext-replay.js) are installed only here, after the
 * sampling decision: at a 5% sampling rate, 95% of visitors get no override of
 * `console.*` or `window.fetch` at all. They load in parallel with rrweb, and the gate is
 * open before either arrives, so early-page activity is kept.
 */
let recordingSidecars = null;

const initRecording = (config = cfg) => {
  if (recordingSidecars) return recordingSidecars;
  if (!computeReplaySessionEnabled(config)) return null;
  sessionCaptureActive = true;
  recordingSidecars = loadExt('r').then(ext => ext && safely(() => ext.install({
    console: captureConsoleAllowed,
    network: captureNetworkAllowed,
  })));
  loadRrweb().then(record => {
    // Not if /tracker/init has since said this visitor is not to be recorded.
    if (record && sessionCaptureActive) safely(() => startRrweb(record, getSessionId(), true));
  });
  return recordingSidecars;
};

/**
 * Start recording as the page opens, on what the last visit's configuration said.
 *
 * Waiting for /tracker/init on every page put a network round trip, then the recorder's
 * download, between a page opening and anything on it being recorded. A visitor who
 * typed into a form or clicked on within that moment — a few hundred milliseconds —
 * had it missing from the replay, and a page left that quickly was not in it at all.
 * The decision is checked again when init answers (`start`): a site that has since
 * switched replay off, or a visitor who has withdrawn consent, is stopped there and what
 * was captured is discarded. A visitor's first page ever has nothing cached and waits.
 */
const startRecordingEarly = () => {
  const config = cachedConfig();
  assumedConfig = config;
  if (!config || !identified()) return;
  safely(() => initRecording(config));
};

/** Stop a recording that was started early and should not have been; drop what it took. */
const abandonRecording = () => {
  sessionCaptureActive = false;
  if (stopRecording) { safely(stopRecording); stopRecording = null; }
  activeRecordingSessionId = null;
  queues.session.length = 0;
  sessionQueueBytes = 0;
};

/** Ask rrweb to take a fresh full snapshot after a navigation (avoids checkout drift). */
const requestRrwebFullSnapshotForNavigation = () => {
  const rec = window.__rrweb_record;
  if (!rec?.takeFullSnapshot) return;
  try { rec.takeFullSnapshot(false); }
  catch { /* not recording yet */ }
};

// ─── Page tracking ────────────────────────────────────────────────────────────

/** Extract UTM parameters from the current URL, or return null if none are present. */
const utmParams = () => {
  const params = new URLSearchParams(location.search);
  const out    = {};
  for (const key of ['source', 'medium', 'campaign', 'term', 'content']) {
    const val = params.get('utm_' + key);
    if (val) out[key] = val;
  }
  return Object.keys(out).length ? out : null;
};

/** Collect basic device / browser context sent with every pageview. */
const deviceInfo = () => ({
  ua:   navigator.userAgent,
  lang: navigator.language,
  sw:   screen.width,
  sh:   screen.height,
  vw:   innerWidth,
  vh:   innerHeight,
  dpr:  devicePixelRatio ?? 1,
  tz:   safely(() => Intl.DateTimeFormat().resolvedOptions().timeZone) ?? '',
});

/**
 * Push a pageview event and evaluate funnels/automations for the current URL.
 * Also closes the previous page view's heatmap scroll summary and opens the next.
 */
const trackPage = () => {
  if (heat) safely(heat.pageEnd);
  pageEnterMs = Date.now();

  const utm = utmParams();
  pushAnalytics('pageview', {
    title:    document.title,
    referrer: document.referrer,
    ...deviceInfo(),
    ...(utm ? {
      utm,
      ...(utm.source   ? { utm_source:   utm.source   } : {}),
      ...(utm.medium   ? { utm_medium:   utm.medium   } : {}),
      ...(utm.campaign ? { utm_campaign: utm.campaign } : {}),
      ...(utm.term     ? { utm_term:     utm.term     } : {}),
      ...(utm.content  ? { utm_content:  utm.content  } : {}),
    } : {}),
  });
  if (heat) safely(heat.pageStart);
  evalFunnels(location.pathname);
  evalGoalsForPage(location.pathname);
  void fireAutomationTrigger('page_view', { path: location.pathname, title: document.title });
};

// ─── Goals ────────────────────────────────────────────────────────────────────
//
// The site's goals arrive in the config. Reports count them on the server; this is the page
// noticing one so an automation can answer it: a custom event named for the goal, a visit to
// its page, or (for an event goal with a selector) a click on that element, which records the
// event the goal waits for.

const goalsOfType = (type) => (Array.isArray(cfg.goals) ? cfg.goals : []).filter((g) => (g.type ?? 'event') === type);

/** Trailing slashes do not make a different page, as in the reports. */
const trimSlash = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

const reachGoal = (goal, extra) => {
  void fireAutomationTrigger('goal_reached', {
    goal_id: goal.id, goal_name: goal.label ?? goal.name, identifier: goal.name, path: location.pathname, ...extra,
  });
};

const evalGoalsForEvent = (name) => {
  for (const goal of goalsOfType('event')) if (goal.name === name) reachGoal(goal);
};

const evalGoalsForPage = (path) => {
  for (const goal of goalsOfType('pageview')) if (trimSlash(String(goal.name)) === trimSlash(path)) reachGoal(goal);
};

/** One delegated click listener for every event goal that names an element. */
const installSelectorGoals = () => {
  const goals = goalsOfType('event').filter((g) => typeof g.selector === 'string' && g.selector.trim());
  if (!goals.length) return;
  document.addEventListener('click', (ev) => {
    const el = ev.target;
    if (!el || !el.closest) return;
    for (const goal of goals) {
      try { if (el.closest(goal.selector)) api.track(goal.name); } catch { /* an invalid selector */ }
    }
  }, true);
};

// ─── Funnels ──────────────────────────────────────────────────────────────────

// Funnel progress is persisted in sessionStorage so a mid-funnel page refresh
// doesn't reset the visitor back to step 0 — for an identified visitor. An anonymous
// one's progress is kept for the page only; the server still sees each step.
const funnelStateKey  = (funnelId) => `snc_fs:${websiteId}:${funnelId}`;

const loadFunnelState = (funnelId) => {
  if (!identified()) return null;
  try {
    const raw = sessionStorage.getItem(funnelStateKey(funnelId));
    return raw != null ? { step: parseInt(raw, 10) || 0 } : null;
  } catch { return null; }
};

const saveFunnelState = (funnelId, step) => {
  if (!identified()) return;
  try { sessionStorage.setItem(funnelStateKey(funnelId), String(step)); }
  catch { /* ignore */ }
};

/** In-memory funnel progress map, seeded from sessionStorage on first access. */
const funnelState = {};

/** The funnel's next step and its progress record, or null when the funnel is empty. */
const nextFunnelStep = (funnel) => {
  const steps = funnel.steps ?? [];
  if (!steps.length) return null;
  const state = funnelState[funnel.id] ?? (funnelState[funnel.id] = loadFunnelState(funnel.id) ?? { step: 0 });
  const step = steps[state.step];
  return step ? { state, step, type: step.step_type ?? step.stepType ?? 'page_view' } : null;
};

/**
 * Advance a funnel by one step: emit funnel_step, and if the last step is reached
 * also emit funnel_complete and reset the step counter.
 */
const advanceFunnelStep = (funnel, state, stepName, path) => {
  pushAnalytics('funnel_step', {
    funnel_id: funnel.id,
    name:      funnel.name,
    step:      state.step,
    step_name: stepName,
    path,
  });
  state.step++;
  const total = (funnel.steps ?? []).length;
  // What an automation sees: the step as a visitor counts it (the first is 1), not the index.
  const info = { funnel_id: funnel.id, funnel_name: funnel.name, step: state.step, step_name: stepName, steps_total: total, path };
  if (state.step === 1) void fireAutomationTrigger('funnel', { ...info, event: 'entry' });
  void fireAutomationTrigger('funnel', { ...info, event: 'step' });
  if (state.step >= total) {
    pushAnalytics('funnel_complete', { funnel_id: funnel.id, name: funnel.name });
    void fireAutomationTrigger('funnel', { ...info, event: 'complete' });
    state.step = 0;
  }
  saveFunnelState(funnel.id, state.step);
};

/**
 * The funnels this visitor has started and not finished, and where each one stands. What
 * "dropping off" is measured against: a visitor at step 2 of 4 who stops, or goes to leave.
 */
const funnelsInProgress = () => {
  const out = [];
  for (const funnel of funnels) {
    const state = funnelState[funnel.id] ?? (funnelState[funnel.id] = loadFunnelState(funnel.id) ?? { step: 0 });
    const steps = funnel.steps ?? [];
    if (state.step < 1 || state.step >= steps.length) continue;
    out.push({
      funnel_id: funnel.id, funnel_name: funnel.name, step: state.step,
      step_name: steps[state.step - 1]?.name ?? '', steps_total: steps.length, path: location.pathname,
    });
  }
  return out;
};

/** Evaluate page_view-type funnel steps on each page view. */
const evalFunnels = (path) => {
  for (const funnel of funnels) {
    const next = nextFunnelStep(funnel);
    if (!next || next.type !== 'page_view') continue; // event steps: evalFunnelsForEvent
    const { state, step } = next;

    const pagePath  = step.page_path ?? step.path;
    const matchType = step.match_type ?? step.matchType ?? 'exact';
    let matched = false;
    if (pagePath) {
      if (matchType === 'contains')         matched = path.includes(pagePath);
      else if (matchType === 'starts_with') matched = path.startsWith(pagePath);
      else if (matchType === 'regex')       matched = safeRegex(pagePath, path);
      else                                  matched = path === pagePath; // exact
    } else if (step.pattern) {
      matched = safeRegex(step.pattern, path);
    }
    if (matched) advanceFunnelStep(funnel, state, step.name, path);
  }
};

/** Evaluate event-type funnel steps — called from seentics.track(). */
const evalFunnelsForEvent = (eventName) => {
  for (const funnel of funnels) {
    const next = nextFunnelStep(funnel);
    if (!next || next.type !== 'event') continue;
    const targetEvent = next.step.event_type ?? next.step.eventType ?? '';
    if (targetEvent && targetEvent === eventName) {
      advanceFunnelStep(funnel, next.state, next.step.name, location.pathname);
    }
  }
};

// ─── Automations ──────────────────────────────────────────────────────────────

/** Rebuild the trigger-type index. Called once per automations load. */
const indexAutomationTriggers = () => {
  const types = new Set();
  for (const auto of automations) {
    for (const t of (auto && Array.isArray(auto.triggers) ? auto.triggers : [])) {
      if (t && t.type) types.add(t.type);
    }
  }
  automationTriggerTypes = types;
};

/**
 * Fire an automation trigger: ask the server which automations it starts, then run the
 * actions that come back.
 *
 * The request is made here rather than in the automations extension, so a page_view
 * automation does not wait for that file to download first; the two happen in parallel,
 * and the actions run once both are in.
 */
const fireAutomationTrigger = async (triggerType, triggerData) => {
  // Automations act on one visitor's behaviour: only for one who may be identified.
  if (!websiteId || !identified()) return;

  // One Set lookup, not a scan of every automation's every trigger. This runs on the
  // hot path — clicks, scroll thresholds, visibility changes — so the answer for a
  // trigger nobody listens for has to be free.
  if (!automationTriggerTypes.has(triggerType)) return;

  // Collapse a burst into one round trip. Rapid triggers can fire several times before
  // the first response lands; without this each costs a request and the actions from
  // all of them render on top of each other.
  //
  // Keyed by what distinguishes one event of a type from another, not by the type alone:
  // a scroll that crosses 50% and 75% at once fires two scroll_depth events, and with a
  // type-only key the second was dropped while the first was in flight — and, its
  // milestone already marked, never fired again.
  const d = triggerData ?? {};
  const inFlightKey = [triggerType, d.depth, d.seconds, d.selector, d.name, d.funnel_id, d.event, d.step, d.goal_id].join('\u0000');
  if (automationInFlight.has(inFlightKey)) return;
  automationInFlight.add(inFlightKey);

  pushAnalytics('automation_trigger', { event: triggerType, props: triggerData });

  try {
    const res = await fetch(apiHost + '/api/v1/tracker/automations/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website_id:   websiteId,
        anonymous_id: getVisitorId(),
        session_id:   getSessionId(),
        trigger:      { type: triggerType, ...triggerData },
        context: {
          page:    location.pathname,
          url:     location.href,
          title:   document.title,
          referrer: document.referrer,
        },
      }),
    });
    if (!res.ok) return;
    const { actions } = await res.json();
    if (actions?.length) {
      // Not before `load`: see `start` — an early script holds the page's `load` back.
      await new Promise((resolve) => afterLoad(resolve));
      const ext = await loadExt('a');
      if (ext) safely(() => ext.execute(actions));
    }
  } catch { /* best-effort */ }
  finally { automationInFlight.delete(inFlightKey); }
};

// ─── JS errors ────────────────────────────────────────────────────────────────

/** Automation triggers stay rate-limited as they always were — firing a workflow is an action. */
const MAX_ERROR_TRIGGER_FIRES = 3;
/**
 * Per-page ceiling on *reported* errors. Higher than the trigger cap because reporting is
 * cheap and a page that throws in a render loop is exactly the page worth seeing — but
 * still a ceiling, because that same loop can throw thousands of times a second and the
 * visitor should not pay for it in bandwidth.
 */
const MAX_ERRORS_PER_PAGE = 10;
const MAX_STACK_CHARS = 4_000;
const MAX_ERROR_MESSAGE_CHARS = 1_000;

/**
 * Report uncaught errors and unhandled rejections, and fire the js_error trigger.
 *
 * Installed as soon as the tracker runs, not after /tracker/init answers: the errors
 * thrown while a page loads were the ones it used to miss.
 */
const installErrorReporting = () => {
  let errorCount = 0;
  let reported = 0;
  /** Fingerprints already reported for this page, so a repeating fault costs one row. */
  const seen = new Set();

  const fire = (message, source) => {
    if (++errorCount > MAX_ERROR_TRIGGER_FIRES) return;
    void fireAutomationTrigger('js_error', { path: location.pathname, message: String(message).slice(0, 200), source: String(source ?? '').slice(0, 100) });
  };

  /**
   * Queue one error for the dashboard.
   *
   * The stack is sent as the browser gives it. Minified frames are still the fastest
   * route to the fault when read next to the replay, and un-minifying belongs on the
   * server where source maps can live, not here.
   */
  const report = (kind, message, source, lineNo, colNo, stack) => {
    if (!trackingAllowed() || cfg.errors_enabled === false) return;
    if (reported >= MAX_ERRORS_PER_PAGE) return;

    const msg = String(message ?? '').slice(0, MAX_ERROR_MESSAGE_CHARS);
    if (!msg) return;

    // Cheap client-side dedup. The server fingerprints properly; this only stops one
    // throwing loop from filling the batch with copies of itself.
    const key = kind + '\0' + msg + '\0' + String(source ?? '');
    if (seen.has(key)) return;
    seen.add(key);
    reported++;

    queues.errors.push({
      type:      'error',
      kind,
      ts:        Date.now(),
      url:       location.href,
      // Ids filled in at the flush (`withIds`), once whether they may be set is known.
      message:   msg,
      source:    String(source ?? '').slice(0, 500),
      line_no:   Number.isFinite(lineNo) ? lineNo : undefined,
      col_no:    Number.isFinite(colNo) ? colNo : undefined,
      stack:     typeof stack === 'string' ? stack.slice(0, MAX_STACK_CHARS) : '',
    });
  };

  window.addEventListener('error', (ev) => {
    // Resource load failures (an <img> 404) arrive here too, with no message.
    if (!ev.message) return;
    fire(ev.message, ev.filename);
    // `ev.error` is absent for cross-origin script errors — the browser gives only
    // "Script error." with no location. Report it anyway: a spike of them is itself the
    // finding, and it usually means a missing `crossorigin` attribute.
    report('error', ev.message, ev.filename, ev.lineno, ev.colno, ev.error?.stack);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    fire(String(reason), 'promise');
    // A rejection's reason is frequently an Error, sometimes a string, occasionally an
    // object with neither. Take the message when there is one; `String()` is the floor.
    const message = reason instanceof Error ? reason.message : String(reason);
    report('unhandledrejection', message, 'promise', undefined, undefined, reason?.stack);
  });
};

// ─── Performance timing ───────────────────────────────────────────────────────

/** Push a performance event with Navigation Timing metrics once the page is fully loaded. */
const trackPerf = () => {
  const entries = performance?.getEntriesByType?.('navigation');
  const timing  = entries?.[0];
  if (!timing?.loadEventEnd) return;
  pushAnalytics('performance', {
    load:    Math.round(timing.loadEventEnd),
    dom:     Math.round(timing.domContentLoadedEventEnd),
    ttfb:    Math.round(timing.responseStart),
    dns:     Math.round(timing.domainLookupEnd - timing.domainLookupStart),
    connect: Math.round(timing.connectEnd      - timing.connectStart),
    render:  Math.round(timing.loadEventEnd    - timing.responseEnd),
  });
};

/** Report timings once the load event has finished (it may already have). */
const schedulePerfTracking = () => {
  if (document.readyState === 'complete') setTimeout(trackPerf, 100);
  else window.addEventListener('load', () => setTimeout(trackPerf, 100), { once: true });
};

// ─── SPA routing ──────────────────────────────────────────────────────────────

/**
 * Detect SPA navigations by patching history.pushState / history.replaceState and
 * listening to popstate. On each navigation: track a new pageview, request a fresh
 * rrweb snapshot for the replay, and let heatmaps capture the new route's layout.
 *
 * Nothing the tracker does here can break the host's navigation: the original method
 * always runs first, its return value is passed back, and the tracker's own work is
 * fenced off. It used to run unguarded inside the patched pushState, so a failure in
 * tracking (storage throwing, say) threw out of the application's router.
 */
const initRouting = () => {
  let lastPath = location.pathname;
  const onNavigation = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    // Before /tracker/init has answered, the first page view (taken then, for whatever
    // path the page is on by that time) covers it.
    if (!started || !trackingAllowed()) return;
    if (autoTrack) trackPage();
    else if (heat) { heat.pageEnd(); heat.pageStart(); }
    // Give the new route 50 ms to mount before asking rrweb for a full snapshot.
    window.setTimeout(requestRrwebFullSnapshotForNavigation, 50);
    if (heat) heat.navigated();
  };
  const guarded = () => safely(onNavigation);
  window.addEventListener('popstate', guarded);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    if (typeof original !== 'function') continue;
    history[method] = function () {
      const result = original.apply(this, arguments);
      guarded();
      return result;
    };
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

let markReady;
const readyPromise = new Promise((resolve) => { markReady = resolve; });

/**
 * Begin tracking, with the site's configuration (or without it, if init failed).
 *
 * One path for both outcomes. There used to be two — the success path and a `.catch`
 * for the failure one — and an exception anywhere in the success path (the first page
 * view, a listener) fell into the `.catch` and ran the setup a second time: two
 * pageviews and every listener installed twice.
 */
const start = (data) => {
  if (data) {
    cfg         = data.config      ?? {};
    funnels     = data.funnels     ?? [];
    automations = data.automations ?? [];
  } else {
    console.warn(
      '[Seentics] tracker running in degraded mode (no session recording). ' +
      'Fix: data-api-host should point to your API (e.g. same origin as this app in dev).',
    );
  }
  indexAutomationTriggers();
  started = true;

  if (!trackingAllowed()) {
    // Strict consent without it, or Do Not Track: nothing — until `seentics.consent(true)`.
    console.info('[Seentics] tracking disabled by the site privacy policy.');
    abandonRecording();
    drainQueues(); // discards anything queued before the policy was known
    markReady();
    return;
  }
  beginTracking();
};

let trackingBegun = false;

/** Page views, events, funnels and errors — what an anonymous visitor gets too. */
const beginTracking = () => {
  if (trackingBegun) return;
  trackingBegun = true;

  // Error tracking switched off: errors caught before the site's configuration arrived
  // are dropped, and `report` queues no more.
  if (cfg.errors_enabled === false) queues.errors.length = 0;

  safely(installSelectorGoals);
  if (autoTrack) safely(trackPage);
  schedulePerfTracking();

  flush(); // send the initial pageview immediately
  flushInterval = window.setInterval(flush, FLUSH_MS);

  if (identified()) enableIdentifiedFeatures();
  else {
    // Started early on a cached configuration this visit no longer has consent for.
    abandonRecording();
    // Anonymous heatmaps: clicks and scroll depth, nothing stored, no snapshot.
    if (cfg.heatmap_enabled !== false) afterLoad(() => loadExt('l').then((ext) => { heat = ext; }));
    // Ask, where the law wants asking and the site has no consent tool of its own. After
    // load, so a consent tool that answers on page load gets there first.
    afterLoad(() => safely(showConsentBanner));
    markReady();
  }
};

let identifiedFeaturesOn = false;

/** Recordings, heatmaps and automations: for a visitor who may be identified. */
const enableIdentifiedFeatures = () => {
  if (identifiedFeaturesOn || !trackingBegun || !identified()) return;
  identifiedFeaturesOn = true;
  // Cached for the next page, which can then start recording without waiting for
  // /tracker/init. Written only now — for an identified visitor.
  storeSet(CONFIG_CACHE_KEY, JSON.stringify(cfg));

  // A recording started early on the cached configuration stands only if the current
  // one agrees (replay still on, this page not excluded). One not started early starts
  // now — at once, not after `load`: the recorder begins at DOMContentLoaded.
  if (recordingSidecars && !computeReplaySessionEnabled()) {
    abandonRecording();
    recordingSidecars = null;
  }
  const recording = safely(initRecording);

  // The features' files are fetched once the page has loaded. A script inserted before
  // `load` holds that event back until it arrives — the page's own `load` handlers, and
  // rrweb, which starts recording at `load`: injected early, they made the recording
  // begin later than before and lose a visitor's first moments on the page.
  afterLoad(() => {
    const loads = [];
    if (cfg.heatmap_enabled !== false) loads.push(loadExt('l').then((ext) => { heat = ext; }));
    if (automations.length) loads.push(loadExt('a'));
    loads.push(recording);
    Promise.all(loads).then(() => markReady(), () => markReady());
  });
};

/** Every key this tracker keeps in the browser for an identified visitor. */
const isTrackerKey = (key) => /^snc_(vid|sid|se|ss|rd|cfg:|fs:|hmshot:)/.test(key);

/**
 * Consent withdrawn: stop everything that identifies the visitor, and remove every id
 * and setting this tracker stored in their browser — the record of the refusal aside.
 */
const withdrawConsent = () => {
  abandonRecording();
  heat = null;
  _visitorId = null;
  _cachedSid = null;
  for (const area of ['localStorage', 'sessionStorage']) {
    try {
      const storage = window[area];
      for (const key of Object.keys(storage)) if (isTrackerKey(key)) storage.removeItem(key);
    } catch { /* storage unavailable */ }
  }
};

/** Run `fn` once the window `load` event has fired (now, if it already has). */
const afterLoad = (fn) => {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', () => fn(), { once: true });
};

const init = () => {
  initRouting();
  installErrorReporting();
  startRecordingEarly();

  // Flush all queued data when the page is hidden (tab switch, navigation away, close).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (heat) safely(heat.beforeLeave);
    flushBeacon();
  });
  window.addEventListener('pagehide', () => {
    if (heat) { safely(heat.pageEnd); safely(heat.beforeLeave); }
    flushBeacon();
  });

  // /tracker/init is requested the moment the tracker runs, and tracking starts once the
  // document is parsed. Both used to wait for the window `load` event — every image,
  // font and ad on the page — so on a slow page the pageview was late, and a visitor who
  // left before `load` was never counted at all.
  const config = fetch(apiHost + '/api/v1/tracker/init/' + websiteId)
    .then(async (response) => {
      if (response.ok) return response.json();
      const text = await response.text().catch(() => '');
      console.warn('[Seentics] tracker init failed:', response.status, response.statusText, text.slice(0, 200));
      return null;
    })
    .catch(() => null);
  const parsed = document.readyState === 'loading'
    ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : null;
  Promise.all([config, parsed]).then(([data]) => start(data));
};

// ─── Public API ───────────────────────────────────────────────────────────────

const api = {
  /**
   * Track a custom event.
   * @param {string} name  - Event name (e.g. 'signup', 'add_to_cart').
   * @param {object} props - Optional event properties.
   */
  track(name, props) {
    pushAnalytics('custom', { name, ...(props ?? {}) });
    evalFunnelsForEvent(name);
    evalGoalsForEvent(name);
    void fireAutomationTrigger('custom_event', { name, ...(props ?? {}) });
  },

  /**
   * Identify the current visitor with a known user ID.
   *
   * The anonymous visitor id is deliberately left alone. Overwriting it split every
   * identified visitor into two uniques and wrote a customer-supplied identifier (very
   * often an email address) into the raw event log. The id travels in the event's own
   * payload; `user_profiles.user_id` links a person's anonymous ids together.
   *
   * @param {string} userId - Your internal user ID.
   * @param {object} traits - Optional user traits (name, email, plan, etc.).
   */
  identify(userId, traits) {
    // Ties the visitor to a person: only with consent (or on a site that asks none).
    // Called earlier, it is dropped rather than kept for later.
    if (started ? !identified() : !consentGranted()) return;
    pushAnalytics('identify', { user_id: userId, traits: traits ?? {} });
    void fireAutomationTrigger('identify', { user_id: userId, traits: traits ?? {} });
  },

  /** Manually push a pageview (useful when auto-tracking is disabled). */
  page: trackPage,

  /** Manually flush all queued events to /collect immediately. */
  flush,

  /**
   * Resolves once the tracker has its configuration and every feature this page uses
   * (heatmaps, automations, recording sidecars) is listening.
   */
  ready: () => readyPromise,

  /**
   * This visitor's id — `null` for an anonymous visitor, who has none. Show it to a
   * visitor who wants to ask for their data: the site owner finds them by it.
   */
  get visitorId() { return identified() ? getVisitorId() : null; },

  /**
   * Tell the tracker the visitor's consent choice — from your consent banner, at any
   * time. `true`: recordings, heatmaps, automations, identify() and the persistent
   * visitor id start now, without a reload. `false`: they stop, and every id this
   * tracker stored in the browser is removed. The choice itself is remembered.
   * @param {boolean} granted
   */
  consent(granted) {
    hideConsentBanner(); // answered — from our card or the site's own banner
    runtimeConsent = granted === true;
    rawSet(CONSENT_KEY, runtimeConsent ? '1' : '0');
    if (!runtimeConsent) { withdrawConsent(); return; }
    if (!started) return; // start() applies it when the configuration arrives
    if (!trackingBegun) beginTracking(); // strict mode, now consented
    else enableIdentifiedFeatures();
  },
};

// ─── Consent banner ───────────────────────────────────────────────────────────
//
// For a visitor in a consent region (the EU/EEA, the UK, Switzerland) on a site with
// session recording on, the default `cookieless` mode asks before recording. A site
// with its own consent tool passes the answer through `seentics.consent()` and never
// sees this; one without gets a small, quiet card — no overlay, nothing blocked, the
// page usable whatever the visitor does. Turn it off with data-consent-banner="off".
// The answer is kept (snc_consent) and the card is not shown again.

const BANNER_ID = 'seentics-consent';
let bannerHost = null;

/** Has this page or an earlier visit already said anything about consent? */
const consentSignalled = () => {
  if (runtimeConsent !== null || window.seenticsConsent !== undefined || script?.hasAttribute('data-consent')) return true;
  try { return localStorage.getItem(CONSENT_KEY) !== null; } catch { return true; }
};

const hideConsentBanner = () => {
  bannerHost?.remove();
  bannerHost = null;
};

const showConsentBanner = () => {
  if (bannerHost || script?.getAttribute('data-consent-banner') === 'off') return;
  // Only when the server says this visitor is where consent is needed (an unknown country
  // included): a core too old to say — a tracker deployed ahead of it — shows no card.
  if (cfg.consent_mode !== 'cookieless' || cfg.consent_region !== true || !replayEnabledForSite()) return;
  if (consentSignalled() || !trackingAllowed()) return;

  const privacyUrl = script?.getAttribute('data-privacy-url');
  const host = document.createElement('div');
  host.id = BANNER_ID;
  const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  root.innerHTML = `
<style>
  :host { all: initial; }
  .card {
    --bg: #ffffff; --fg: #18181b; --muted: #52525b; --line: #e4e4e7;
    --btn: #18181b; --btn-fg: #ffffff; --ghost: #f4f4f5;
    position: fixed; z-index: 2147483000; left: 16px; bottom: 16px; box-sizing: border-box;
    width: min(380px, calc(100vw - 32px)); padding: 16px 16px 14px;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.06);
    font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    animation: in .22s ease-out;
  }
  @media (prefers-color-scheme: dark) {
    .card { --bg: #18181b; --fg: #fafafa; --muted: #a1a1aa; --line: #27272a; --btn: #fafafa; --btn-fg: #18181b; --ghost: #27272a; }
  }
  @media (max-width: 480px) { .card { left: 8px; right: 8px; bottom: 8px; width: auto; } }
  @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  h2 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
  p { margin: 0; color: var(--muted); font-size: 13px; }
  a { color: inherit; text-underline-offset: 2px; }
  .row { display: flex; gap: 8px; margin-top: 12px; }
  button {
    flex: 1; min-height: 36px; padding: 0 12px; border-radius: 9px; border: 0; cursor: pointer;
    font: 600 13px/1 inherit; font-family: inherit;
  }
  .yes { background: var(--btn); color: var(--btn-fg); }
  .no { background: var(--ghost); color: var(--fg); }
  button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
</style>
<div class="card" role="dialog" aria-live="polite" aria-labelledby="snc-t" aria-describedby="snc-d">
  <h2 id="snc-t">Help us improve this site</h2>
  <p id="snc-d">May we record how you use this site — clicks, scrolling and the pages you visit — to find and fix problems? Anything you type stays hidden.${privacyUrl ? ` <a href="${encodeURI(privacyUrl)}" target="_blank" rel="noopener">Privacy policy</a>` : ''}</p>
  <div class="row">
    <button class="no" type="button">No thanks</button>
    <button class="yes" type="button">Allow</button>
  </div>
</div>`;
  root.querySelector('.yes').addEventListener('click', () => api.consent(true));
  root.querySelector('.no').addEventListener('click', () => api.consent(false));
  bannerHost = host;
  (document.body || document.documentElement).appendChild(host);
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * One tracker per website per page. A snippet pasted twice (a theme header and a tag
 * manager, say) used to run twice: every pageview, click and event counted double, and
 * two recorders fighting over one session.
 */
const loaded = window.__seentics_sites || (window.__seentics_sites = {});
if (!websiteId) {
  // Nothing is sent without a website id, but the page's own `seentics.track()` calls
  // must still find the API rather than throw.
  window.seentics = window.seentics || api;
  markReady();
} else if (loaded[websiteId]) {
  console.warn('[Seentics] tracker loaded twice for this website; ignoring the second copy.');
} else {
  loaded[websiteId] = true;
  window.seentics = api;
  init();
}
