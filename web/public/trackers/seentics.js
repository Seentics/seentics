/*!
 * Seentics Tracker v2 — analytics, session recording, funnels & automations
 * Recording: rrweb (lazy-loaded after init) + gzip compression + batching
 * Analytics:  batched, sendBeacon, single /collect endpoint
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
 * When `data-api-host` is omitted, derive the host from this script's own URL.
 * The same host serves /api/v1/... (e.g. via a Next.js rewrite to the gateway),
 * so pageviews, heatmaps, and session batches all hit the customer's own stack.
 * Falls back to https://api.seentics.com only for inline scripts (no src).
 */
function defaultApiHostFromScript() {
  const src = script?.src?.trim();
  if (!src) return 'https://api.seentics.com';
  try {
    const u = new URL(src);
    if (!u.host) return 'https://api.seentics.com';
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'https://api.seentics.com';
  }
}

const apiHost   = normalizeApiBase(script?.getAttribute('data-api-host') ?? defaultApiHostFromScript());
const autoTrack = script?.getAttribute('data-auto-track') !== 'false';
const domain    = window.location.hostname;

if (!websiteId) {
  console.warn(
    '[Seentics] data-website-id is missing or empty. ' +
    'If the script tag has async or defer, remove it — the tracker must execute ' +
    'synchronously to read its own attributes.',
  );
}

// rrweb.min.js lives next to seentics.min.js; override via data-rrweb-src if needed.
const _scriptSrc = script?.src ?? '';
const rrwebSrc =
  script?.getAttribute('data-rrweb-src') ??
  (_scriptSrc ? _scriptSrc.replace(/[^/?#]*\.js[^/]*$/, 'rrweb.min.js') : '');

// ─── Constants ────────────────────────────────────────────────────────────────

const COLLECT        = apiHost + '/api/v1/tracker/collect';
const FLUSH_MS       = 10_000;          // periodic flush interval (10 s)
const SESSION_MAX_MS = 30 * 60 * 1000; // hard session cap (30 min)

/**
 * rrweb internal numeric constants used in mirrorHeatmapFromRrweb.
 * Defined here so magic numbers don't appear inline in the logic below.
 * Source: https://github.com/rrweb-io/rrweb/blob/master/packages/types/src/index.ts
 */
const RRWEB_EVENT_TYPE = {
  IncrementalSnapshot: 3,
};
const RRWEB_INCREMENTAL_SOURCE = {
  MouseMove:        1,
  MouseInteraction: 2,
  Scroll:           3,
};
const RRWEB_MOUSE_INTERACTION = {
  Click: 2,
};

// ─── Runtime state ────────────────────────────────────────────────────────────

/** Config, funnels, and automations loaded from /tracker/init on boot. */
let cfg         = {};
let funnels     = [];
let automations = [];
let flushInterval = null;

/**
 * In-memory queues for each event category.
 * All queues are drained together into a single /collect POST every FLUSH_MS.
 */
const queues = {
  events:             [], // pageviews, custom events, performance, identify
  funnels:            [], // funnel_step, funnel_complete
  automations:        [], // automation_trigger
  session:            [], // rrweb eventWithTime wrapped in a TrackerEvent envelope
  heatmaps:           [], // heatmap_click, heatmap_scroll
  heatmap_screenshot: [], // browser-captured JPEG screenshots (html2canvas)
};

// ─── Visitor / Session IDs ────────────────────────────────────────────────────

/** Safe localStorage access — returns null if storage is blocked (e.g. private mode). */
const getStore = () => { try { return localStorage; } catch { return null; } };

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

/** Persistent visitor ID — set once and stored in localStorage forever. */
let visitorId = (() => {
  const store = getStore();
  if (!store) return 'v-' + rnd();
  let id = store.getItem('snc_vid');
  if (!id) {
    id = 'v-' + rnd() + Date.now().toString(36);
    store.setItem('snc_vid', id);
  }
  return id;
})();

/**
 * In-memory session ID cache.
 * Without caching, getSessionId() would perform 3 synchronous localStorage ops on
 * every pushAnalytics() call. With caching, storage is only re-read after genuine
 * inactivity (when the in-memory expiry has lapsed), and the expiry write is
 * throttled to once per minute while the session is active.
 */
let _cachedSid       = null;
let _cachedSidExpiry = 0;  // absolute ms at which the cached sid should be considered expired
let _lastExpiryWrite = 0;  // last time we wrote snc_se to storage

const getSessionId = () => {
  const now = Date.now();

  // Fast path: in-memory cache is still warm.
  if (_cachedSid && now < _cachedSidExpiry) {
    // Throttle the storage write to once per minute.
    // Other tabs can observe activity at minute granularity; no write on every event.
    if (now - _lastExpiryWrite > 60_000) {
      _lastExpiryWrite = now;
      _cachedSidExpiry = now + SESSION_MAX_MS;
      getStore()?.setItem('snc_se', String(_cachedSidExpiry));
    }
    return _cachedSid;
  }

  // Cache miss — fall back to storage (first call, or after genuine inactivity).
  const store = getStore();
  if (!store) {
    _cachedSid       = 's-' + now.toString(36);
    _cachedSidExpiry = now + SESSION_MAX_MS;
    return _cachedSid;
  }

  let id        = store.getItem('snc_sid');
  const expiry  = store.getItem('snc_se');   // inactivity expiry timestamp
  const started = store.getItem('snc_ss');   // session start time (for hard cap)

  const inactivityExpired = !id || !expiry || now > +expiry;
  const hardCapExceeded   = !!started && (now - +started) >= SESSION_MAX_MS;

  if (inactivityExpired || hardCapExceeded) {
    id = 's-' + rnd() + now.toString(36);
    store.setItem('snc_sid', id);
    store.setItem('snc_ss', String(now));
  }

  _cachedSidExpiry = now + SESSION_MAX_MS;
  store.setItem('snc_se', String(_cachedSidExpiry));
  _cachedSid       = id;
  _lastExpiryWrite = now;
  return id;
};

// ─── Queue helpers ────────────────────────────────────────────────────────────

/** Map an event type string to its queue key. */
const categoryOf = (type) => {
  if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
  if (type === 'automation_trigger')                        return 'automations';
  if (type === 'heatmap_click' || type === 'heatmap_scroll') return 'heatmaps';
  return 'events';
};

/** Push a typed analytics event onto the appropriate queue. */
const pushAnalytics = (type, data) => {
  queues[categoryOf(type)].push({
    type,
    data,
    ts:  Date.now(),
    url: location.href,
    sid: getSessionId(),
    vid: visitorId,
  });
};

// ─── Network transport ────────────────────────────────────────────────────────

/**
 * Send JSON compressed with gzip via XHR.
 * Used for large payloads (session recording, big heatmap batches) where sendBeacon's
 * ~64 KB limit would be exceeded. Falls back to plain JSON if CompressionStream
 * is unavailable (Firefox < 113, older Safari).
 */
const sendGzip = async (json) => {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(new TextEncoder().encode(json));
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', COLLECT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Content-Encoding', 'gzip');
      xhr.send(buf);
      return;
    } catch (_) { /* fall through to plain JSON */ }
  }
  const xhr = new XMLHttpRequest();
  xhr.open('POST', COLLECT, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(json);
};

/**
 * Build the /collect payload from all non-empty queues and return {payload, json}.
 * Returns null when all queues are empty (nothing to send).
 */
const drainQueues = () => {
  const events      = queues.events.splice(0);
  const funnelEvts  = queues.funnels.splice(0);
  const autoEvts    = queues.automations.splice(0);
  const sessionEvts = queues.session.splice(0);
  const heatmapEvts = queues.heatmaps.splice(0);
  const shotEvts    = queues.heatmap_screenshot.splice(0);

  if (!events.length && !funnelEvts.length && !autoEvts.length && !sessionEvts.length && !heatmapEvts.length && !shotEvts.length) {
    return null;
  }

  const payload = { website_id: websiteId, domain };
  if (events.length)      payload.events             = events;
  if (funnelEvts.length)  payload.funnels            = funnelEvts;
  if (autoEvts.length)    payload.automations        = autoEvts;
  if (sessionEvts.length) payload.session            = sessionEvts;
  if (heatmapEvts.length) payload.heatmaps           = heatmapEvts;
  if (shotEvts.length)    payload.heatmap_screenshot = shotEvts;

  return { payload, json: JSON.stringify(payload), sessionEvts, heatmapEvts, shotEvts };
};

// ─── Flush functions ──────────────────────────────────────────────────────────

/**
 * Periodic flush — drains all queues and sends to /collect.
 * Also restarts rrweb if the session ID rotated since recording began
 * (so the new session gets a fresh FullSnapshot baseline).
 */
const flush = () => {
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
  const { json, sessionEvts, heatmapEvts, shotEvts } = drained;

  // Session recording, screenshot payloads, or large batches: gzip to stay under the sendBeacon limit.
  if (sessionEvts.length > 0 || shotEvts.length > 0 || heatmapEvts.length > 400 || json.length > 55_000) {
    sendGzip(json);
    return;
  }

  // Analytics-only payload: sendBeacon is fire-and-forget and survives page navigation.
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon) { navigator.sendBeacon(COLLECT, blob); return; }

  // sendBeacon not available (very old browser): plain async XHR.
  const xhr = new XMLHttpRequest();
  xhr.open('POST', COLLECT, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(json);
};

/**
 * Unload flush — called on visibilitychange:hidden and pagehide.
 * Must use keepalive fetch (or sendBeacon) because the page is closing.
 * Synchronous XHR is deprecated in Chrome 80+ and silently dropped during unload.
 */
const flushBeacon = () => {
  const drained = drainQueues();
  if (!drained) return;
  const { json, sessionEvts, heatmapEvts, shotEvts } = drained;

  // Large payloads exceed sendBeacon's ~64 KB limit — use keepalive fetch instead.
  if (sessionEvts.length > 0 || shotEvts.length > 0 || heatmapEvts.length > 400 || json.length > 55_000) {
    try {
      fetch(COLLECT, {
        method: 'POST',
        body: json,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
    } catch { /* ignore — page is already closing */ }
    return;
  }

  // Small payload: prefer sendBeacon (guaranteed delivery, no keepalive size concerns).
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon(COLLECT, blob)) return;

  // sendBeacon rejected or unavailable — fall back to keepalive fetch.
  try {
    fetch(COLLECT, {
      method: 'POST',
      body: json,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  } catch { /* ignore — page is already closing */ }
};

// ─── rrweb lazy loader ────────────────────────────────────────────────────────

// rrweb is loaded on demand — only when session recording is actually enabled.
// After loading, rrweb sets window.__rrweb_record = record.
let _rrwebLoadPromise = null;

/**
 * Inject rrweb.min.js into the page once and return the record function.
 * Subsequent calls return the same promise (guaranteed single load).
 */
const loadRrweb = () => {
  if (_rrwebLoadPromise) return _rrwebLoadPromise;
  _rrwebLoadPromise = new Promise((resolve) => {
    if (window.__rrweb_record) { resolve(window.__rrweb_record); return; }
    if (!rrwebSrc)              { resolve(null); return; }
    const tag   = document.createElement('script');
    tag.src     = rrwebSrc;
    tag.onload  = () => resolve(window.__rrweb_record ?? null);
    tag.onerror = () => resolve(null);
    document.head.appendChild(tag);
  });
  return _rrwebLoadPromise;
};

/**
 * Attach window error and unhandledrejection listeners that push errors into the
 * session queue so they appear as annotations in the replay timeline.
 * Guards against double-installation with a flag on window.
 */
const installSessionClientErrorCapture = () => {
  if (window.__snc_err_cap) return;
  window.__snc_err_cap = true;

  const enqueueError = (data) => {
    queues.session.push({
      type: 'session_error',
      data,
      ts:  Date.now(),
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  };

  window.addEventListener('error', (ev) => {
    enqueueError({
      message:  ev.message  || 'Script error',
      filename: ev.filename || undefined,
      lineno:   ev.lineno   || undefined,
      colno:    ev.colno    || undefined,
      stack:    ev.error?.stack || undefined,
    });
  }, true);

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const isErr  = reason instanceof Error;
    enqueueError({
      message: isErr ? reason.message : String(reason ?? 'Unhandled rejection'),
      stack:   isErr ? reason.stack   : undefined,
    });
  });
};

// ─── Heatmap screenshot (server-side Playwright) ──────────────────────────────

/**
 * Per-tab, per-path dedup key stored in sessionStorage.
 * Once a screenshot request succeeds for a path, we don't send another until
 * the user navigates to a different path (or opens a new tab).
 */
const heatmapScreenshotSentKey = () => {
  if (!websiteId) return '';
  try { return `snc_hmshot:${websiteId}:${location.pathname}`; }
  catch { return ''; }
};

const hasSentHeatmapScreenshotForPath = () => {
  const key = heatmapScreenshotSentKey();
  if (!key) return false;
  try { return sessionStorage.getItem(key) === '1'; }
  catch { return false; }
};

const markHeatmapScreenshotSentForPath = () => {
  const key = heatmapScreenshotSentKey();
  if (!key) return;
  try { sessionStorage.setItem(key, '1'); }
  catch { /* ignore */ }
};

/** Timeouts queued after load/navigation to let the page fully render first. */
let screenshotScheduleTimeouts  = [];
let screenshotLongPageInterval  = null;

const clearScreenshotScheduleTimers = () => {
  for (const id of screenshotScheduleTimeouts) window.clearTimeout(id);
  screenshotScheduleTimeouts = [];
};

const clearScreenshotLongPageInterval = () => {
  if (screenshotLongPageInterval != null) {
    window.clearInterval(screenshotLongPageInterval);
    screenshotLongPageInterval = null;
  }
};

/**
 * Fire a lightweight POST to /tracker/request-screenshot.
 * The server handles deduplication (in-memory cache → DB → Playwright), so
 * repeated calls for an unchanged page are fast no-ops on the server side.
 */
const requestPlaywrightScreenshot = () => {
  if (cfg.heatmap_layout_enabled === false) return;
  if (hasSentHeatmapScreenshotForPath()) return;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiHost + '/api/v1/tracker/request-screenshot', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 202) markHeatmapScreenshotSentForPath();
    };
    xhr.send(JSON.stringify({
      website_id: websiteId,
      page_url:   location.href,
      page_path:  location.pathname,
    }));
  } catch { /* ignore */ }
};

/**
 * Schedule staggered screenshot requests after a page load or SPA navigation.
 * The two delays (1.5 s, 4 s) give lazy-loaded content time to appear before
 * Playwright fetches the page server-side. The sessionStorage dedup flag ensures
 * only the first successful request per path triggers an actual capture.
 */
const scheduleHeatmapScreenshotAfterAppIdle = () => {
  if (cfg.heatmap_layout_enabled === false) return;
  clearScreenshotScheduleTimers();
  clearScreenshotLongPageInterval();
  for (const delayMs of [1_500, 4_000]) {
    screenshotScheduleTimeouts.push(window.setTimeout(requestPlaywrightScreenshot, delayMs));
  }
  // Also schedule a browser-side capture (html2canvas) for pages Playwright can't
  // reach (e.g. authenticated pages). Runs once per path per session.
  screenshotScheduleTimeouts.push(window.setTimeout(captureAndQueueBrowserScreenshot, 3_000));
};

/**
 * Lazy-load html2canvas from CDN and return the constructor, or null on failure.
 * Cached after the first load so subsequent calls are instant.
 */
let _html2canvasPromise = null;
const loadHtml2Canvas = () => {
  if (_html2canvasPromise) return _html2canvasPromise;
  _html2canvasPromise = new Promise((resolve) => {
    try {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve(typeof window.html2canvas === 'function' ? window.html2canvas : null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    } catch { resolve(null); }
  });
  return _html2canvasPromise;
};

/**
 * Capture the current viewport as a JPEG using html2canvas and push it onto
 * the heatmap_screenshot queue so it's sent on the next flush.
 * Runs once per path per session — skips if a Playwright screenshot was already
 * successfully requested for this path.
 */
const captureAndQueueBrowserScreenshot = async () => {
  if (cfg.heatmap_layout_enabled === false) return;
  if (hasSentHeatmapScreenshotForPath()) return;
  try {
    const h2c = await loadHtml2Canvas();
    if (!h2c) return;
    const canvas = await h2c(document.body, {
      useCORS: true,
      allowTaint: false,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (!dataUrl || dataUrl.length < 500) return;
    queues.heatmap_screenshot.push({
      type:  'heatmap_screenshot',
      ts:    Date.now(),
      url:   location.href,
      sid:   getSessionId(),
      vid:   getVisitorId(),
      doc_w: document.documentElement.scrollWidth || document.body.scrollWidth || window.innerWidth,
      doc_h: document.documentElement.scrollHeight || document.body.scrollHeight || window.innerHeight,
      data:  { image: dataUrl },
    });
    flush();
  } catch { /* ignore — html2canvas failures are non-critical */ }
};

// ─── Safe regex ───────────────────────────────────────────────────────────────

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

// ─── URL pattern matching (for recording/heatmap include/exclude rules) ───────

/** Split a newline-delimited pattern string into trimmed, non-empty lines. */
const patternLines = (patterns) => {
  if (!patterns) return [];
  return patterns.split('\n').map(p => p.trim()).filter(Boolean);
};

/** Returns true when the pattern string contains at least one non-empty line. */
const hasEffectivePatterns = (patterns) => patternLines(patterns).length > 0;

/** Returns true when the current page URL matches any line in the pattern string. */
const matchesPatterns = (patterns) => {
  const lines = patternLines(patterns);
  if (!lines.length) return false;
  return lines.some(p => safeRegex(p, location.href));
};

// ─── Heatmaps (click + scroll depth) ─────────────────────────────────────────

/** Returns true when heatmap capture is enabled and the current URL is not excluded. */
const heatmapAllowed = () => {
  if (cfg.heatmap_enabled === false) return false;
  const includePatterns = cfg.heatmap_include_patterns;
  const excludePatterns = cfg.heatmap_exclude_patterns;
  if (hasEffectivePatterns(includePatterns) && !matchesPatterns(includePatterns)) return false;
  if (hasEffectivePatterns(excludePatterns) && matchesPatterns(excludePatterns))  return false;
  return true;
};

/** Scroll depth as a 0–1 fraction of the scrollable document height. */
const scrollDepth01 = () => {
  const el = document.documentElement;
  const scrollableHeight = el.scrollHeight - el.clientHeight;
  if (scrollableHeight <= 0) return 1;
  return Math.min(1, Math.max(0, el.scrollTop / scrollableHeight));
};

/**
 * CSS layout viewport dimensions in pixels.
 * The dashboard uses these to size the heatmap overlay iframe to the correct breakpoint.
 * Uses visualViewport when available to handle pinch-zoom on mobile correctly.
 */
const heatmapViewportCss = () => {
  const vv   = typeof visualViewport !== 'undefined' && visualViewport ? visualViewport : null;
  const rawW = vv?.width  ?? (typeof innerWidth  === 'number' ? innerWidth  : 0);
  const rawH = vv?.height ?? (typeof innerHeight === 'number' ? innerHeight : 0);
  return {
    vw: Math.max(1, Math.round(rawW)),
    vh: Math.max(1, Math.round(rawH)),
  };
};

/**
 * Cached result of the document dimension scan (1 s TTL).
 * The scan is expensive on large DOMs so we share its result across rapid
 * successive calls (e.g. rrweb emit bursts during a scroll).
 */
let heatmapMetricsCache = null;

/**
 * Compute the full document bounding box (width × height in CSS pixels).
 *
 * documentElement.scrollHeight alone is insufficient for app shells that fix
 * the body height and scroll inside an inner container (e.g. a `main` element
 * with overflow:auto). We walk up to 3 000 body descendant nodes and take the
 * max scrollWidth / scrollHeight of any element that is actually overflowing.
 */
const heatmapDocumentMetrics = () => {
  const now = typeof performance?.now === 'function' ? performance.now() : Date.now();
  if (heatmapMetricsCache && now - heatmapMetricsCache.at < 1_000) {
    return { dw: heatmapMetricsCache.dw, dh: heatmapMetricsCache.dh };
  }

  const docEl = document.documentElement;
  const body  = document.body;
  let dw = Math.max(1, docEl.scrollWidth, body?.scrollWidth ?? 0, docEl.clientWidth  || 1);
  let dh = Math.max(1, docEl.scrollHeight, body?.scrollHeight ?? 0, docEl.clientHeight || 1);

  // Scan descendant elements for overflow scroll regions.
  if (body) {
    try {
      const nodes = body.getElementsByTagName('*');
      const cap   = Math.min(nodes.length, 3_000);
      for (let i = 0; i < cap; i++) {
        const node = nodes[i];
        if (!(node instanceof HTMLElement)) continue;
        // Only expand the bounding box when the node is genuinely overflowing
        // (scrollable content exceeds its layout box by more than 4 px).
        if (node.scrollWidth  > node.clientWidth  + 4) dw = Math.max(dw, node.scrollWidth);
        if (node.scrollHeight > node.clientHeight + 4) dh = Math.max(dh, node.scrollHeight);
      }
    } catch { /* ignore — live NodeList can throw on certain mutations */ }
  }

  heatmapMetricsCache = { at: now, dw, dh };
  return { dw, dh };
};

/**
 * Convert rrweb's viewport-relative (clientX, clientY) coordinates to document
 * (page) coordinates, accounting for both window scroll and any intermediate
 * overflow:auto ancestor scroll offsets (including shadow DOM hosts).
 *
 * rrweb records MouseInteraction and MouseMove positions in viewport space.
 * For apps with scrollable inner regions (dashboards, chat windows, etc.) we
 * need to add the scroll offset of each ancestor element to land on the correct
 * document position.
 */
const rrwebClientToDocumentXY = (clientX, clientY) => {
  const docEl = document.documentElement;
  const body  = document.body;
  let pageX   = clientX + (window.scrollX ?? window.pageXOffset ?? 0);
  let pageY   = clientY + (window.scrollY ?? window.pageYOffset ?? 0);
  try {
    let el = document.elementFromPoint(clientX, clientY);
    while (el && el !== docEl && el !== body) {
      if (el instanceof HTMLElement) {
        pageX += el.scrollLeft;
        pageY += el.scrollTop;
      }
      // Pierce shadow DOM boundaries so positions inside web components are correct.
      const root = el.getRootNode();
      el = (root instanceof ShadowRoot && root.host) ? root.host : el.parentElement;
    }
  } catch { /* ignore — elementFromPoint can throw in sandboxed iframes */ }
  return { pageX, pageY };
};

/** Normalise absolute page coordinates to 0–1 fractions of the document size. */
const heatmapNormFromPageXY = (pageX, pageY) => {
  const { dw, dh } = heatmapDocumentMetrics();
  return {
    nx: Math.min(1, Math.max(0, pageX / dw)),
    ny: Math.min(1, Math.max(0, pageY / dh)),
  };
};

/** Build a short CSS-selector hint for the clicked element (used for element-level reports). */
const heatmapSelectorHint = (el) => {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id.replace(/\s/g, '')}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    if (classes) return `${tag}.${classes}`;
  }
  return tag;
};

let heatmapListenersInstalled     = false;
let heatmapPointerBridgeInstalled = false;

/**
 * The most recent pointerdown's page coordinates.
 * rrweb's MouseInteraction click event carries viewport (client) coordinates, but
 * for accurate heatmap positioning we prefer the page coordinates from the native
 * pointerdown which fired just before rrweb's synthetic click. This bridge captures
 * them and the rrweb mirror reads them back within a 900 ms window.
 */
let lastPointerDocForHeatmap = null;

/**
 * Install a capturing pointerdown listener that records the exact page coordinates
 * of each pointer press. Used as a fallback coordinate source in mirrorHeatmapFromRrweb.
 */
const installHeatmapPointerPageBridge = () => {
  if (heatmapPointerBridgeInstalled) return;
  heatmapPointerBridgeInstalled = true;
  document.addEventListener('pointerdown', (ev) => {
    if (cfg.heatmap_enabled === false) return;
    if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen' && ev.pointerType !== 'touch') return;
    lastPointerDocForHeatmap = {
      pageX:   ev.pageX,
      pageY:   ev.pageY,
      clientX: ev.clientX,
      clientY: ev.clientY,
      at: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
  }, true);
};

/** Maximum scroll depth reached on the current page URL (reset on navigation). */
let heatmapScrollMax = 0;
/** Timestamp of the last heatmap_scroll event (shared by DOM scroll and rrweb scroll mirror). */
let heatmapScrollThrottleAt = 0;
/** Timestamp of the last heatmap point from rrweb MouseMove (throttled to avoid a point flood). */
let heatmapMouseMoveThrottleAt = 0;

/**
 * Inspect each rrweb event emitted during recording and derive heatmap data points.
 * This lets heatmaps work even when session recording is active without adding a
 * second set of separate DOM listeners.
 *
 * rrweb event structure we handle:
 *   type === IncrementalSnapshot (3)
 *     data.source === MouseMove (1)        → cursor position batch
 *     data.source === MouseInteraction (2) → click / tap, data.type === Click (2)
 *     data.source === Scroll (3)           → scroll depth update
 */
const mirrorHeatmapFromRrweb = (ev) => {
  if (cfg.heatmap_enabled === false) return;
  if (Number(ev?.type) !== RRWEB_EVENT_TYPE.IncrementalSnapshot) return;

  const inner = ev.data;
  if (!inner || typeof inner !== 'object') return;
  const source = Number(inner.source);

  // ── MouseMove: throttled cursor position ──────────────────────────────────
  if (source === RRWEB_INCREMENTAL_SOURCE.MouseMove) {
    if (!Array.isArray(inner.positions) || inner.positions.length === 0) return;
    const now = Date.now();
    if (now - heatmapMouseMoveThrottleAt < 350) return;
    heatmapMouseMoveThrottleAt = now;

    const pos = inner.positions[inner.positions.length - 1];
    const px  = Number(pos.x);
    const py  = Number(pos.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;

    // Invalidate the metrics cache: a scroll may have happened since the last sample.
    heatmapMetricsCache = null;
    const { pageX, pageY } = rrwebClientToDocumentXY(px, py);
    const { nx, ny }       = heatmapNormFromPageXY(pageX, pageY);
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: { nx, ny, target: 'rrweb-move', vw: vp.vw, vh: vp.vh },
      ts:  now,
      url: location.href,
      sid: activeRecordingSessionId ?? getSessionId(),
      vid: visitorId,
    });
    return;
  }

  // ── MouseInteraction → Click ──────────────────────────────────────────────
  if (
    source === RRWEB_INCREMENTAL_SOURCE.MouseInteraction &&
    Number(inner.type) === RRWEB_MOUSE_INTERACTION.Click
  ) {
    const clientX = Number(inner.x);
    const clientY = Number(inner.y);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    // Invalidate the metrics cache: page may have scrolled between last sample and this click.
    heatmapMetricsCache = null;

    const now    = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const bridge = lastPointerDocForHeatmap;
    let pageX, pageY;

    // Prefer the page coordinates from the native pointerdown bridge (more accurate for
    // overflow-scroll regions) if it fired within 900 ms and is within 8 px of this click.
    if (
      bridge &&
      now - bridge.at < 900 &&
      Math.abs(bridge.clientX - clientX) <= 8 &&
      Math.abs(bridge.clientY - clientY) <= 8
    ) {
      pageX = bridge.pageX;
      pageY = bridge.pageY;
      lastPointerDocForHeatmap = null;
    } else {
      ({ pageX, pageY } = rrwebClientToDocumentXY(clientX, clientY));
    }

    const { nx, ny } = heatmapNormFromPageXY(pageX, pageY);
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: { nx, ny, target: 'rrweb', vw: vp.vw, vh: vp.vh },
      ts:  Date.now(),
      url: location.href,
      sid: activeRecordingSessionId ?? getSessionId(),
      vid: visitorId,
    });
    return;
  }

  // ── Scroll: update max depth ──────────────────────────────────────────────
  if (source === RRWEB_INCREMENTAL_SOURCE.Scroll) {
    const depth = scrollDepth01();
    if (depth > heatmapScrollMax) heatmapScrollMax = depth;
    const now = Date.now();
    if (now - heatmapScrollThrottleAt < 450) return;
    heatmapScrollThrottleAt = now;
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_scroll',
      data: { depth: heatmapScrollMax, vw: vp.vw, vh: vp.vh },
      ts:  now,
      url: location.href,
      sid: activeRecordingSessionId ?? getSessionId(),
      vid: visitorId,
    });
  }
};

/**
 * Attach the heatmap click and scroll DOM listeners.
 * When rrweb is running these listeners are skipped (stopRecording != null) because
 * mirrorHeatmapFromRrweb already derives the same data from the rrweb event stream —
 * avoiding double-counting.
 */
const installHeatmapCapture = () => {
  if (cfg.heatmap_enabled === false) return;
  installHeatmapPointerPageBridge();
  if (heatmapListenersInstalled) return;
  heatmapListenersInstalled = true;

  document.addEventListener('click', (ev) => {
    if (stopRecording != null) return; // rrweb is recording — mirrorHeatmapFromRrweb handles clicks
    if (!heatmapAllowed()) return;
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-seentics-block]')) return;
    const { nx, ny } = heatmapNormFromPageXY(ev.pageX, ev.pageY);
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: { nx, ny, target: heatmapSelectorHint(target), vw: vp.vw, vh: vp.vh },
      ts:  Date.now(),
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  }, true);

  window.addEventListener('scroll', () => {
    if (stopRecording != null) return; // rrweb handles scroll via mirrorHeatmapFromRrweb
    if (!heatmapAllowed()) return;
    const depth = scrollDepth01();
    if (depth > heatmapScrollMax) heatmapScrollMax = depth;
    const now = Date.now();
    if (now - heatmapScrollThrottleAt < 450) return;
    heatmapScrollThrottleAt = now;
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_scroll',
      data: { depth: heatmapScrollMax, vw: vp.vw, vh: vp.vh },
      ts:  now,
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  }, { passive: true });
};

// ─── rrweb recording ──────────────────────────────────────────────────────────

/** Stop function returned by rrweb record(); null when recording is off. */
let stopRecording = null;
/** Session ID that the active rrweb instance is recording under. */
let activeRecordingSessionId = null;

/**
 * rrweb record() options.
 * Tuned for bandwidth efficiency: higher sampling intervals, no canvas / font / inline-CSS capture.
 */
const RRWEB_OPTIONS = {
  recordAfter:      'load',
  checkoutEveryNms: 120_000, // full DOM snapshot every 2 min (default is 1 min)
  maskAllInputs:    true,
  blockSelector:    '[data-seentics-block]',
  ignoreSelector:   '[data-seentics-ignore]',
  recordShadowDOM:  true,
  sampling: {
    mousemove: 100,    // sample every 100 ms (rrweb default is 50 ms)
    scroll:    150,
    media:     800,
    input:     'last', // only send the final input value, not every keystroke
  },
  inlineStylesheet: false, // send stylesheet URLs, not the full CSS text
  collectFonts:     false, // skip base64-embedded fonts (can be several MB per snapshot)
  recordCanvas:     false, // skip canvas frame capture (charts, maps, etc. are too large)
  errorHandler:     (_err) => { /* keep the emit pipeline alive on bad DOM mutations */ },
};

/** Returns true when this visitor's session should be shipped as session recording rows. */
const computeReplaySessionEnabled = () => {
  if (cfg.replay_enabled === false || cfg.recording === false) return false;
  const samplingRate = typeof cfg.replay_sampling_rate === 'number' ? cfg.replay_sampling_rate : 1.0;
  if (samplingRate < 1.0 && Math.random() > samplingRate) return false;
  if (hasEffectivePatterns(cfg.replay_include_patterns) && !matchesPatterns(cfg.replay_include_patterns)) return false;
  if (hasEffectivePatterns(cfg.replay_exclude_patterns) &&  matchesPatterns(cfg.replay_exclude_patterns)) return false;
  return true;
};

/**
 * Start (or restart) rrweb under the given session ID.
 * Restarts are needed when the session ID rotates (inactivity / hard cap) so the
 * new session begins with a fresh FullSnapshot rather than an orphaned incremental stream.
 */
const startRrweb = (record, sessionId, shouldRecordSession) => {
  if (stopRecording) {
    try { stopRecording(); } catch { /* ignore */ }
    stopRecording = null;
  }
  activeRecordingSessionId = sessionId;
  const stop = record({
    ...RRWEB_OPTIONS,
    emit(event) {
      // Always mirror into heatmaps (click positions, scroll depth).
      mirrorHeatmapFromRrweb(event);
      // Only queue the raw rrweb event for replay if this session is sampled in.
      if (shouldRecordSession) {
        queues.session.push({
          type: 'rrweb',
          data: event,
          ts:   event.timestamp,
          url:  location.href,
          sid:  activeRecordingSessionId,
          vid:  visitorId,
        });
      }
    },
  });
  if (typeof stop === 'function') stopRecording = stop;
};

const initRecording = async () => {
  if (cfg.replay_enabled === false || cfg.recording === false) return;
  const shouldRecordSession = computeReplaySessionEnabled();
  if (!shouldRecordSession) return;
  const record = await loadRrweb();
  if (!record) return;
  startRrweb(record, getSessionId(), shouldRecordSession);
};

// ─── Utilities ────────────────────────────────────────────────────────────────

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
  tz:   Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? '',
});

// ─── Page tracking ────────────────────────────────────────────────────────────

/**
 * Push a pageview event and evaluate funnels/automations for the current URL.
 * Also resets per-page heatmap state (scroll depth, throttle timestamps, pointer bridge).
 */
const trackPage = () => {
  heatmapScrollMax           = 0;
  heatmapScrollThrottleAt    = 0;
  heatmapMouseMoveThrottleAt = 0;
  lastPointerDocForHeatmap   = null;

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
  evalFunnels(location.pathname);
  evalAutomations('pageview', { path: location.pathname, title: document.title });
};

// ─── Funnels ──────────────────────────────────────────────────────────────────

// Funnel progress is persisted in sessionStorage so a mid-funnel page refresh
// doesn't reset the visitor back to step 0.
const funnelStateKey  = (funnelId) => `snc_fs:${websiteId}:${funnelId}`;

const loadFunnelState = (funnelId) => {
  try {
    const raw = sessionStorage.getItem(funnelStateKey(funnelId));
    return raw != null ? { step: parseInt(raw, 10) || 0 } : null;
  } catch { return null; }
};

const saveFunnelState = (funnelId, step) => {
  try { sessionStorage.setItem(funnelStateKey(funnelId), String(step)); }
  catch { /* ignore */ }
};

/** In-memory funnel progress map, seeded from sessionStorage on first access. */
const funnelState = {};

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
  if (state.step >= (funnel.steps ?? []).length) {
    pushAnalytics('funnel_complete', { funnel_id: funnel.id, name: funnel.name });
    state.step = 0;
  }
  saveFunnelState(funnel.id, state.step);
};

/** Evaluate page_view-type funnel steps on each SPA navigation. */
const evalFunnels = (path) => {
  for (const funnel of funnels) {
    const steps = funnel.steps ?? [];
    if (!steps.length) continue;

    const state   = funnelState[funnel.id] ?? (funnelState[funnel.id] = loadFunnelState(funnel.id) ?? { step: 0 });
    const nextStep = steps[state.step];
    if (!nextStep) continue;

    const stepType = nextStep.step_type ?? nextStep.stepType ?? 'page_view';
    if (stepType !== 'page_view') continue; // event-type steps are handled by evalFunnelsForEvent

    const pagePath  = nextStep.page_path ?? nextStep.path;
    const matchType = nextStep.match_type ?? nextStep.matchType ?? 'exact';
    let matched = false;
    if (pagePath) {
      if (matchType === 'contains')         matched = path.includes(pagePath);
      else if (matchType === 'starts_with') matched = path.startsWith(pagePath);
      else if (matchType === 'regex')       matched = safeRegex(pagePath, path);
      else                                  matched = path === pagePath; // exact
    } else if (nextStep.pattern) {
      matched = safeRegex(nextStep.pattern, path);
    }
    if (matched) advanceFunnelStep(funnel, state, nextStep.name, path);
  }
};

/** Evaluate event-type funnel steps — called from seentics.track(). */
const evalFunnelsForEvent = (eventName) => {
  for (const funnel of funnels) {
    const steps = funnel.steps ?? [];
    if (!steps.length) continue;

    const state    = funnelState[funnel.id] ?? (funnelState[funnel.id] = loadFunnelState(funnel.id) ?? { step: 0 });
    const nextStep = steps[state.step];
    if (!nextStep) continue;

    const stepType   = nextStep.step_type ?? nextStep.stepType ?? 'page_view';
    if (stepType !== 'event') continue;

    const targetEvent = nextStep.event_type ?? nextStep.eventType ?? '';
    if (targetEvent && targetEvent === eventName) {
      advanceFunnelStep(funnel, state, nextStep.name, location.pathname);
    }
  }
};

// ─── Automation triggers ──────────────────────────────────────────────────────

/**
 * Evaluate all automation rules for a given trigger event.
 * If an automation's trigger event matches and all its conditions pass,
 * an automation_trigger event is queued.
 */
const evalAutomations = (triggerEvent, props) => {
  for (const automation of automations) {
    const trigger = automation.trigger;
    if (!trigger || trigger.event !== triggerEvent) continue;
    const conditionsMet = (trigger.conditions ?? []).every((condition) => {
      const value = props[condition.field];
      if (condition.op === 'eq')       return value === condition.value;
      if (condition.op === 'neq')      return value !== condition.value;
      if (condition.op === 'contains') return value != null && String(value).includes(condition.value);
      if (condition.op === 'regex')    return value != null && safeRegex(condition.value, String(value));
      if (condition.op === 'gt')       return +value > +condition.value;
      if (condition.op === 'lt')       return +value < +condition.value;
      return true;
    });
    if (conditionsMet) {
      pushAnalytics('automation_trigger', {
        automation_id: automation.id,
        name:          automation.name,
        event:         triggerEvent,
        props,
      });
    }
  }
};

// ─── Exit-intent trigger ──────────────────────────────────────────────────────

let exitIntentCooldown = false;

/** Fire the exit_intent automation trigger when the cursor leaves through the top of the viewport. */
const installExitIntent = () => {
  document.addEventListener('mouseleave', (ev) => {
    if (ev.clientY > 0) return; // only fire when leaving through the top edge
    if (exitIntentCooldown) return;
    exitIntentCooldown = true;
    evalAutomations('exit_intent', { path: location.pathname });
    setTimeout(() => { exitIntentCooldown = false; }, 30_000); // 30 s cooldown
  });
};

// ─── Inactivity trigger ───────────────────────────────────────────────────────

const INACTIVITY_TRIGGER_MS = 30_000;
let inactivityTimer     = null;
let inactivityInstalled = false;

const resetInactivityTimer = () => {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    evalAutomations('inactivity', { path: location.pathname, inactivity_ms: INACTIVITY_TRIGGER_MS });
    inactivityTimer = null;
  }, INACTIVITY_TRIGGER_MS);
};

/** Listen for any user activity and reset the inactivity timer each time. */
const installInactivity = () => {
  if (inactivityInstalled) return;
  inactivityInstalled = true;
  for (const eventName of ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']) {
    window.addEventListener(eventName, resetInactivityTimer, { passive: true });
  }
  resetInactivityTimer();
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

// ─── SPA routing ──────────────────────────────────────────────────────────────

/**
 * Detect SPA navigations by patching history.pushState / history.replaceState and
 * listening to popstate. On each navigation: track a new pageview, request a fresh
 * rrweb snapshot for the replay, and schedule a new heatmap screenshot.
 */
const initRouting = () => {
  let lastPath = location.pathname;
  const onNavigation = () => {
    if (location.pathname === lastPath) return;
    clearScreenshotScheduleTimers();
    lastPath = location.pathname;
    if (autoTrack) trackPage();
    // Give the new route 50 ms to mount before asking rrweb for a full snapshot.
    window.setTimeout(requestRrwebFullSnapshotForNavigation, 50);
    if (cfg.heatmap_layout_enabled !== false) {
      scheduleHeatmapScreenshotAfterAppIdle();
    }
  };
  window.addEventListener('popstate', onNavigation);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method].bind(history);
    history[method] = (...args) => { original(...args); onNavigation(); };
  }
};

/** Ask rrweb to take a fresh full snapshot after a navigation (avoids checkout drift). */
const requestRrwebFullSnapshotForNavigation = () => {
  const rec = window.__rrweb_record;
  if (!rec?.takeFullSnapshot) return;
  try { rec.takeFullSnapshot(false); }
  catch { /* not recording yet */ }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

const init = () => {
  if (!websiteId) return;

  initRouting();

  // Flush all queued data when the page is hidden (tab switch, navigation away, close).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBeacon();
  });
  window.addEventListener('pagehide', flushBeacon);

  fetch(apiHost + '/api/v1/tracker/init/' + websiteId)
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn('[Seentics] tracker init failed:', response.status, response.statusText, text?.slice?.(0, 200) ?? '');
        throw new Error('tracker init failed');
      }
      return response.json();
    })
    .then(async (data) => {
      cfg         = data.config      ?? {};
      funnels     = data.funnels     ?? [];
      automations = data.automations ?? [];

      if (autoTrack) trackPage();

      // Session recording setup.
      if (cfg.replay_enabled !== false && cfg.recording !== false) {
        installSessionClientErrorCapture();
        await initRecording();
      }

      // Heatmap screenshot scheduling.
      if (cfg.heatmap_layout_enabled !== false) {
        scheduleHeatmapScreenshotAfterAppIdle();
      }

      installHeatmapCapture();
      installExitIntent();
      installInactivity();
      window.addEventListener('load', () => setTimeout(trackPerf, 100));

      flush(); // send the initial pageview + rrweb snapshot immediately
      flushInterval = window.setInterval(flush, FLUSH_MS);
    })
    .catch(() => {
      // Init failed (network error, wrong domain, etc.) — run in degraded mode.
      // Analytics and heatmaps still work; session recording is unavailable.
      console.warn(
        '[Seentics] tracker running in degraded mode (no session recording). ' +
        'Fix: data-api-host should point to your API (e.g. same origin as this app in dev).',
      );
      if (autoTrack) trackPage();
      installHeatmapCapture();
      installExitIntent();
      installInactivity();
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
      flush();
      flushInterval = window.setInterval(flush, FLUSH_MS);
    });
};

// ─── Public API ───────────────────────────────────────────────────────────────

window.seentics = {
  /**
   * Track a custom event.
   * @param {string} name  - Event name (e.g. 'signup', 'add_to_cart').
   * @param {object} props - Optional event properties.
   */
  track(name, props) {
    pushAnalytics('custom', { name, ...(props ?? {}) });
    evalFunnelsForEvent(name);
    evalAutomations('custom', { name, ...(props ?? {}) });
  },

  /**
   * Identify the current visitor with a known user ID.
   * Also persists the ID in localStorage so it survives page reloads.
   * @param {string} userId - Your internal user ID.
   * @param {object} traits - Optional user traits (name, email, plan, etc.).
   */
  identify(userId, traits) {
    getStore()?.setItem('snc_vid', userId);
    visitorId = userId;
    pushAnalytics('identify', { user_id: userId, traits: traits ?? {} });
  },

  /** Manually push a pageview (useful when auto-tracking is disabled). */
  page: trackPage,

  /** Manually flush all queued events to /collect immediately. */
  flush,
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
