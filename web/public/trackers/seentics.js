/*!
 * Seentics Tracker v2 — analytics, session recording, funnels & automations
 * Recording: rrweb (lazy-loaded after init) + gzip compression + batching
 * Analytics:  batched, sendBeacon, single /collect endpoint
 */

const script = document.currentScript;
/** Website UUID — same value as the dashboard project id (data-website-id). */
const websiteId = script?.getAttribute('data-website-id') ?? '';

/** Strip trailing /api/v1 so COLLECT = origin + '/api/v1/tracker/collect' never doubles the prefix. */
function normalizeApiBase(raw) {
  let s = raw.trim().replace(/\/+$/, '');
  while (/\/api\/v1$/i.test(s)) {
    s = s.replace(/\/api\/v1$/i, '');
  }
  return s;
}

/**
 * When `data-api-host` is omitted, use the origin of this script's URL (dashboard / CDN).
 * Same host serves `/api/v1/...` (e.g. Next rewrites to the gateway) so pageviews, heatmaps,
 * and session batches all hit your stack — not a hard-coded SaaS default.
 * Falls back to https://api.seentics.com only when `src` is missing (inline script).
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
  console.warn('[Seentics] data-website-id is missing or empty. If the script tag has async or defer, remove it — the tracker must execute synchronously to read its own attributes.');
}

// rrweb.min.js lives next to seentics.min.js; override via data-rrweb-src if needed.
const _scriptSrc = script?.src ?? '';
const rrwebSrc =
  script?.getAttribute('data-rrweb-src') ??
  (_scriptSrc ? _scriptSrc.replace(/[^/?#]*\.js[^/]*$/, 'rrweb.min.js') : '');

const COLLECT        = apiHost + '/api/v1/tracker/collect';
const FLUSH_MS       = 10_000;           // 10 s periodic flush interval
const SESSION_MAX_MS = 30 * 60 * 1000;  // 30 min hard session cap

// ─── State ────────────────────────────────────────────────────────────────────
let cfg         = {};
let funnels     = [];
let automations = [];
let flushInterval = null;

const queues = {
  events:     [],
  funnels:    [],
  automations:[],
  session:    [],   // rrweb eventWithTime wrapped in TrackerEvent envelope
  heatmaps:   [],   // heatmap_click / heatmap_scroll for /collect heatmaps
};

// ─── Visitor / Session IDs ────────────────────────────────────────────────────
const getStore = () => { try { return localStorage; } catch { return null; } };

// Cryptographically random token; falls back to Math.random if unavailable.
const rnd = () => {
  try {
    const arr = new Uint8Array(9);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(36)).join('');
  } catch {
    return Math.random().toString(36).slice(2, 11);
  }
};

let visitorId = (() => {
  const s = getStore();
  if (!s) return 'v-' + rnd();
  let id = s.getItem('snc_vid');
  if (!id) {
    id = 'v-' + rnd() + Date.now().toString(36);
    s.setItem('snc_vid', id);
  }
  return id;
})();

// In-memory session cache — avoids 3 synchronous localStorage ops on every pushAnalytics call.
// Storage is only re-read when the in-memory expiry lapses (i.e. after real inactivity).
let _cachedSid       = null;
let _cachedSidExpiry = 0;    // absolute ms when the cached sid should be treated as expired
let _lastExpiryWrite = 0;    // last time we wrote snc_se to storage

const getSessionId = () => {
  const now = Date.now();
  // Fast path: in-memory cache is still warm.
  if (_cachedSid && now < _cachedSidExpiry) {
    // Throttle the storage write to once per minute so other tabs can observe activity
    // without paying a localStorage write on every single event.
    if (now - _lastExpiryWrite > 60_000) {
      _lastExpiryWrite = now;
      _cachedSidExpiry = now + SESSION_MAX_MS;
      getStore()?.setItem('snc_se', String(_cachedSidExpiry));
    }
    return _cachedSid;
  }
  // Cache miss — fall back to storage (first call, or after genuine inactivity).
  const s = getStore();
  if (!s) {
    _cachedSid       = 's-' + now.toString(36);
    _cachedSidExpiry = now + SESSION_MAX_MS;
    return _cachedSid;
  }
  let id          = s.getItem('snc_sid');
  const exp       = s.getItem('snc_se');
  const ss        = s.getItem('snc_ss');
  const inactivityExpired = !id || !exp || now > +exp;
  const hardCapExceeded   = !!ss && (now - +ss) >= SESSION_MAX_MS;
  if (inactivityExpired || hardCapExceeded) {
    id = 's-' + rnd() + now.toString(36);
    s.setItem('snc_sid', id);
    s.setItem('snc_ss', String(now));
  }
  _cachedSidExpiry = now + SESSION_MAX_MS;
  s.setItem('snc_se', String(_cachedSidExpiry));
  _cachedSid       = id;
  _lastExpiryWrite = now;
  return id;
};

// ─── Queue helpers ────────────────────────────────────────────────────────────
const categoryOf = (type) => {
  if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
  if (type === 'automation_trigger')                        return 'automations';
  if (type === 'heatmap_click' || type === 'heatmap_scroll') return 'heatmaps';
  return 'events';
};

const pushAnalytics = (type, data) => {
  queues[categoryOf(type)].push({ type, data, ts: Date.now(), url: location.href, sid: getSessionId(), vid: visitorId });
};

// Gzip via native CompressionStream; falls back to plain JSON if unavailable.
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
    } catch (_) { /* fall through */ }
  }
  const xhr = new XMLHttpRequest();
  xhr.open('POST', COLLECT, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(json);
};

// ─── Unified flush — sends all queues to /collect in one request ──────────────
const flush = () => {
  // Session hard-cap check: if the session rotated since we last started rrweb,
  // restart recording so the new session gets a fresh FullSnapshot baseline.
  if (activeRecordingSessionId !== null) {
    const currentSid = getSessionId();
    if (currentSid !== activeRecordingSessionId) {
      loadRrweb().then(record => {
        if (record) startRrweb(record, currentSid, computeReplaySessionEnabled());
      });
    }
  }

  const e = queues.events.splice(0);
  const f = queues.funnels.splice(0), a = queues.automations.splice(0);
  const s = queues.session.splice(0);
  const h = queues.heatmaps.splice(0);
  if (!e.length && !f.length && !a.length && !s.length && !h.length) return;

  const payload = { website_id: websiteId, domain };
  if (e.length) payload.events      = e;
  if (f.length) payload.funnels     = f;
  if (a.length) payload.automations = a;
  if (s.length) payload.session     = s;
  if (h.length) payload.heatmaps    = h;
  const json = JSON.stringify(payload);

  // Session or large heatmap batches: gzip + XHR (sendBeacon ~64 KB)
  if (s.length > 0 || h.length > 400 || json.length > 55_000) {
    sendGzip(json);
    return;
  }

  // Analytics-only: sendBeacon is most reliable on page close
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon) { navigator.sendBeacon(COLLECT, blob); return; }
  const xhr = new XMLHttpRequest();
  xhr.open('POST', COLLECT, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(json);
};

const flushAnalytics = flush; // keep public API name

// flushBeacon is used on page close (visibilitychange / pagehide).
// Unlike flush(), it sends ALL queued data — including session recording events —
// via sendBeacon so the browser guarantees delivery even as the page unloads.
// Falls back to synchronous XHR if sendBeacon is unavailable or rejects the payload.
const flushBeacon = () => {
  const e = queues.events.splice(0);
  const f = queues.funnels.splice(0), a = queues.automations.splice(0);
  const s = queues.session.splice(0);
  const h = queues.heatmaps.splice(0);
  if (!e.length && !f.length && !a.length && !s.length && !h.length) return;

  const payload = { website_id: websiteId, domain };
  if (e.length) payload.events      = e;
  if (f.length) payload.funnels     = f;
  if (a.length) payload.automations = a;
  if (s.length) payload.session     = s;
  if (h.length) payload.heatmaps    = h;
  const json = JSON.stringify(payload);
  if (s.length > 0 || h.length > 400 || json.length > 55_000) {
    // keepalive fetch continues after the page is unloaded — sync XHR is deprecated in modern browsers.
    try { fetch(COLLECT, { method: 'POST', body: json, headers: { 'Content-Type': 'application/json' }, keepalive: true }); } catch { /* ignore */ }
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon(COLLECT, blob)) return;
  try { fetch(COLLECT, { method: 'POST', body: json, headers: { 'Content-Type': 'application/json' }, keepalive: true }); } catch { /* ignore — page is already closing */ }
};

// ─── rrweb lazy loader ────────────────────────────────────────────────────────
// rrweb.min.js is loaded on demand — only when session recording is actually needed.
// It sets window.__rrweb_record = record after loading.
let _rrwebPromise = null;

/** Capture window errors + unhandled rejections for replay session metadata. */
const installSessionClientErrorCapture = () => {
  if (window.__snc_err_cap) return;
  window.__snc_err_cap = true;

  const enqueue = (data) => {
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
    enqueue({
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
    enqueue({
      message: isErr ? reason.message : String(reason ?? 'Unhandled rejection'),
      stack:   isErr ? reason.stack   : undefined,
    });
  });
};

const loadRrweb = () => {
  if (_rrwebPromise) return _rrwebPromise;
  _rrwebPromise = new Promise((resolve) => {
    if (window.__rrweb_record) { resolve(window.__rrweb_record); return; }
    if (!rrwebSrc)              { resolve(null); return; }
    const s   = document.createElement('script');
    s.src     = rrwebSrc;
    s.onload  = () => resolve(window.__rrweb_record ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return _rrwebPromise;
};

/**
 * Per-tab, per path: one heatmap screenshot upload per pathname until navigation (saves bandwidth).
 */
const heatmapScreenshotSentKey = () => {
  if (!websiteId) return '';
  try {
    return `snc_hmshot:${websiteId}:${location.pathname}`;
  } catch {
    return '';
  }
};

const hasSentHeatmapScreenshotForPath = () => {
  const k = heatmapScreenshotSentKey();
  if (!k) return false;
  try {
    return sessionStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};

const markHeatmapScreenshotSentForPath = () => {
  const k = heatmapScreenshotSentKey();
  if (!k) return;
  try {
    sessionStorage.setItem(k, '1');
  } catch {
    /* ignore */
  }
};

/** Timeouts for post-load / post-nav screenshots (cleared on navigation). */
let heatmapScreenshotRefreshTimeouts = [];
let heatmapScreenshotLongPageInterval = null;

const clearHeatmapScreenshotRefreshTimers = () => {
  for (const id of heatmapScreenshotRefreshTimeouts) {
    window.clearTimeout(id);
  }
  heatmapScreenshotRefreshTimeouts = [];
};

const clearHeatmapScreenshotLongPageInterval = () => {
  if (heatmapScreenshotLongPageInterval != null) {
    window.clearInterval(heatmapScreenshotLongPageInterval);
    heatmapScreenshotLongPageInterval = null;
  }
};

/** SPA / replay: ask rrweb for a fresh full snapshot when recording (checkout drift), not for heatmap JPEGs. */
const requestRrwebFullSnapshotForNavigation = () => {
  const rec = window.__rrweb_record;
  if (!rec?.takeFullSnapshot) return;
  try {
    rec.takeFullSnapshot(false);
  } catch {
    /* not recording yet */
  }
};

/** Skip capture on paths that are almost certainly the Seentics dashboard. */
const shouldSkipHeatmapScreenshotForPath = () => {
  try {
    const p = location.pathname;
    if (p.startsWith('/websites/')) return true;
    if (p.startsWith('/preview/'))  return true;
    return false;
  } catch {
    return false;
  }
};

/**
 * Request a server-side Playwright screenshot for the current page.
 * Sends a single lightweight POST to /api/v1/tracker/request-screenshot; the server
 * captures the page with headless Chrome and stores it in S3.
 * Server-side deduplication (cache → DB → Playwright) means the browser only
 * launches once — repeated calls for the same path are fast no-ops.
 */
const requestPlaywrightScreenshot = () => {
  if (cfg.heatmap_layout_enabled === false) return;
  if (shouldSkipHeatmapScreenshotForPath()) return;
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
      page_url: location.href,
      page_path: location.pathname,
    }));
  } catch {
    /* ignore */
  }
};

/**
 * After load or SPA navigation, schedule screenshot requests with staggered delays
 * so the page has time to fully render before Playwright fetches it server-side.
 * Once the first request succeeds (202), sessionStorage dedup prevents duplicates.
 */
const scheduleHeatmapScreenshotAfterAppIdle = () => {
  if (cfg.heatmap_layout_enabled === false) return;
  clearHeatmapScreenshotRefreshTimers();
  clearHeatmapScreenshotLongPageInterval();
  const delaysMs = [1_500, 4_000];
  for (const ms of delaysMs) {
    heatmapScreenshotRefreshTimeouts.push(window.setTimeout(requestPlaywrightScreenshot, ms));
  }
};

// ─── Safe regex — guards against ReDoS ───────────────────────────────────────
// Patterns longer than 500 chars fall back to plain string.includes.
const safeRegex = (pattern, subject) => {
  if (pattern.length > 500) return subject.includes(pattern);
  try { return new RegExp(pattern).test(subject); } catch { return subject.includes(pattern); }
};

// ─── rrweb recording ──────────────────────────────────────────────────────────
const patternLines = (patterns) => {
  if (!patterns) return [];
  return patterns.split('\n').map(p => p.trim()).filter(Boolean);
};

/** True when there is at least one non-empty URL pattern line (after trim). */
const hasEffectivePatterns = (patterns) =>
  patternLines(patterns).length > 0;

const matchesPatterns = (patterns) => {
  const list = patternLines(patterns);
  if (!list.length) return false;
  const url = location.href;
  return list.some(p => safeRegex(p, url));
};

// ─── Heatmaps (click + scroll depth) ─────────────────────────────────────────
const heatmapAllowed = () => {
  if (cfg.heatmap_enabled === false) return false;
  const inc = cfg.heatmap_include_patterns;
  const exc = cfg.heatmap_exclude_patterns;
  if (hasEffectivePatterns(inc) && !matchesPatterns(inc)) return false;
  if (hasEffectivePatterns(exc) && matchesPatterns(exc)) return false;
  return true;
};

const scrollDepth01 = () => {
  const el = document.documentElement;
  const sh = el.scrollHeight - el.clientHeight;
  if (sh <= 0) return 1;
  return Math.min(1, Math.max(0, el.scrollTop / sh));
};

/** CSS layout viewport (px) at sample time — dashboard sizes the heatmap iframe to match breakpoints. */
const heatmapViewportCss = () => {
  const vv = typeof visualViewport !== 'undefined' && visualViewport ? visualViewport : null;
  const rawW = vv?.width ?? (typeof innerWidth === 'number' ? innerWidth : 0);
  const rawH = vv?.height ?? (typeof innerHeight === 'number' ? innerHeight : 0);
  return {
    vw: Math.max(1, Math.round(rawW)),
    vh: Math.max(1, Math.round(rawH)),
  };
};

/** Last heatmap metric sample (inner scroll scans can be hot during rrweb bursts). */
let heatmapMetricsCache = null;

/**
 * Max layout box: html/body plus any overflow scroll regions (flex dashboards often fix body height
 * and scroll inside `main` / a div — documentElement.scrollHeight stays viewport-sized).
 */
const heatmapDocumentMetrics = () => {
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  if (heatmapMetricsCache && now - heatmapMetricsCache.at < 1_000) {
    return { dw: heatmapMetricsCache.dw, dh: heatmapMetricsCache.dh };
  }

  const el   = document.documentElement;
  const body = document.body;
  let dw = Math.max(1, el.scrollWidth, body?.scrollWidth ?? 0, el.clientWidth || 1);
  let dh = Math.max(1, el.scrollHeight, body?.scrollHeight ?? 0, el.clientHeight || 1);

  if (body) {
    try {
      const nodes = body.getElementsByTagName('*');
      const cap = Math.min(nodes.length, 3_000);
      for (let i = 0; i < cap; i++) {
        const node = nodes[i];
        if (!(node instanceof HTMLElement)) continue;
        const sw = node.scrollWidth;
        const sh = node.scrollHeight;
        const cw = node.clientWidth;
        const ch = node.clientHeight;
        if (sw > cw + 4) dw = Math.max(dw, sw);
        if (sh > ch + 4) dh = Math.max(dh, sh);
      }
    } catch {
      /* ignore */
    }
  }

  heatmapMetricsCache = { at: now, dw, dh };
  return { dw, dh };
};

/**
 * rrweb MouseInteraction / MouseMove only stores clientX/clientY (viewport).
 * App shells that scroll inside `overflow: auto` regions need ancestor scroll offsets too.
 */
const rrwebClientToDocumentXY = (clientX, clientY) => {
  const docEl = document.documentElement;
  const body  = document.body;
  const winX  = window.scrollX ?? window.pageXOffset ?? 0;
  const winY  = window.scrollY ?? window.pageYOffset ?? 0;
  let pageX = clientX + winX;
  let pageY = clientY + winY;
  try {
    let el = document.elementFromPoint(clientX, clientY);
    while (el && el !== docEl && el !== body) {
      if (el instanceof HTMLElement) {
        pageX += el.scrollLeft;
        pageY += el.scrollTop;
      }
      const root = el.getRootNode();
      if (root instanceof ShadowRoot && root.host) {
        el = root.host;
      } else {
        el = el.parentElement;
      }
    }
  } catch {
    /* ignore */
  }
  return { pageX, pageY };
};

const heatmapNormFromPageXY = (pageX, pageY) => {
  const { dw, dh } = heatmapDocumentMetrics();
  return {
    nx: Math.min(1, Math.max(0, pageX / dw)),
    ny: Math.min(1, Math.max(0, pageY / dh)),
  };
};

const heatmapSelectorHint = (el) => {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id.replace(/\s/g, '')}`;
  if (el.className && typeof el.className === 'string') {
    const c = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    if (c) return `${tag}.${c}`;
  }
  return tag;
};

let heatmapListenersInstalled      = false;
let heatmapPointerBridgeInstalled  = false;
let lastPointerDocForHeatmap       = null;

const installHeatmapPointerPageBridge = () => {
  if (heatmapPointerBridgeInstalled) return;
  heatmapPointerBridgeInstalled = true;
  const onPointerDown = (ev) => {
    if (cfg.heatmap_enabled === false) return;
    if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen' && ev.pointerType !== 'touch') return;
    lastPointerDocForHeatmap = {
      pageX:   ev.pageX,
      pageY:   ev.pageY,
      clientX: ev.clientX,
      clientY: ev.clientY,
      at: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
  };
  document.addEventListener('pointerdown', onPointerDown, true);
};

/** Max scroll depth on the current page URL (reset in trackPage). */
let heatmapScrollMax = 0;
/** Throttle for heatmap_scroll rows (DOM scroll + rrweb scroll mirror share this). */
let heatmapScrollThrottleAt = 0;
/** Throttle rrweb MouseMove → heatmap points (session often has moves but no clicks yet). */
let heatmapMouseMoveThrottleAt = 0;

/**
 * When rrweb is recording, mirror incremental snapshots into the heatmap queue.
 * rrweb: EventType.IncrementalSnapshot = 3; IncrementalSource.MouseMove = 1;
 * MouseInteraction = 2; MouseInteractions.Click = 2; IncrementalSource.Scroll = 3.
 */
const mirrorHeatmapFromRrweb = (ev) => {
  if (cfg.heatmap_enabled === false) return;
  const evType = Number(ev?.type);
  if (evType !== 3) return; // IncrementalSnapshot
  const inner = ev.data;
  if (!inner || typeof inner !== 'object') return;
  const src = Number(inner.source);

  // MouseMove batches (source 1)
  if (src === 1 && Array.isArray(inner.positions) && inner.positions.length > 0) {
    const now = Date.now();
    if (now - heatmapMouseMoveThrottleAt < 350) return;
    heatmapMouseMoveThrottleAt = now;
    const pos = inner.positions[inner.positions.length - 1];
    const px  = Number(pos.x);
    const py  = Number(pos.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    heatmapMetricsCache = null;
    const { pageX, pageY } = rrwebClientToDocumentXY(px, py);
    const { nx, ny }       = heatmapNormFromPageXY(pageX, pageY);
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: { nx, ny, target: 'rrweb-move', vw: vp.vw, vh: vp.vh },
      ts: now,
      url: location.href,
      sid: activeRecordingSessionId ?? getSessionId(),
      vid: visitorId,
    });
    return;
  }

  // Click (viewport coordinates)
  const miType = Number(inner.type);
  if (src === 2 && miType === 2) {
    const x = Number(inner.x);
    const y = Number(inner.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    heatmapMetricsCache = null;
    const now    = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const bridge = lastPointerDocForHeatmap;
    let pageX, pageY;
    if (
      bridge &&
      now - bridge.at < 900 &&
      Math.abs(bridge.clientX - x) <= 8 &&
      Math.abs(bridge.clientY - y) <= 8
    ) {
      pageX = bridge.pageX;
      pageY = bridge.pageY;
      lastPointerDocForHeatmap = null;
    } else {
      const conv = rrwebClientToDocumentXY(x, y);
      pageX = conv.pageX;
      pageY = conv.pageY;
    }
    const { nx, ny } = heatmapNormFromPageXY(pageX, pageY);
    const vp = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: { nx, ny, target: 'rrweb', vw: vp.vw, vh: vp.vh },
      ts: Date.now(),
      url: location.href,
      sid: activeRecordingSessionId ?? getSessionId(),
      vid: visitorId,
    });
    return;
  }

  // Scroll depth
  if (src === 3) {
    const d = scrollDepth01();
    if (d > heatmapScrollMax) heatmapScrollMax = d;
    const now = Date.now();
    if (now - heatmapScrollThrottleAt < 450) return;
    heatmapScrollThrottleAt = now;
    const vpRr = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_scroll',
      data: { depth: heatmapScrollMax, vw: vpRr.vw, vh: vpRr.vh },
      ts: now,
      url: location.href,
      sid: activeRecordingSessionId ?? getSessionId(),
      vid: visitorId,
    });
  }
};

const installHeatmapCapture = () => {
  if (cfg.heatmap_enabled === false) return;
  installHeatmapPointerPageBridge();
  if (heatmapListenersInstalled) return;
  heatmapListenersInstalled = true;

  document.addEventListener('click', (ev) => {
    if (stopRecording != null) return;
    if (!heatmapAllowed()) return;
    const t = ev.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-seentics-block]')) return;
    const { nx, ny } = heatmapNormFromPageXY(ev.pageX, ev.pageY);
    const vpC = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: { nx, ny, target: heatmapSelectorHint(t), vw: vpC.vw, vh: vpC.vh },
      ts: Date.now(),
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  }, true);

  const onScroll = () => {
    if (stopRecording != null) return;
    if (!heatmapAllowed()) return;
    const d = scrollDepth01();
    if (d > heatmapScrollMax) heatmapScrollMax = d;
    const now = Date.now();
    if (now - heatmapScrollThrottleAt < 450) return;
    heatmapScrollThrottleAt = now;
    const vpSc = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_scroll',
      data: { depth: heatmapScrollMax, vw: vpSc.vw, vh: vpSc.vh },
      ts: now,
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
};

/** Stop function returned by rrweb record(); null when recording is off. */
let stopRecording = null;
/** The session ID that the current rrweb instance is recording under. */
let activeRecordingSessionId = null;

const RRWEB_OPTIONS = {
  recordAfter:     'load',
  checkoutEveryNms: 120_000,  // Full snapshot every 2 min instead of 1 min — halves snapshot frequency
  maskAllInputs:   true,
  blockSelector:   '[data-seentics-block]',
  ignoreSelector:  '[data-seentics-ignore]',
  recordShadowDOM: true,
  sampling: {
    mousemove: 100,   // Every 100ms instead of 50ms — halves mouse move event volume
    scroll:    150,
    media:     800,
    input:     'last',
  },
  inlineStylesheet: false,  // Don't inline full CSS text — stylesheet URLs are enough for replay
  collectFonts:     false,  // Don't base64-embed font files — they can be MB per snapshot
  recordCanvas:     false,  // Don't capture canvas frames — major data sink (charts, maps, etc.)
  errorHandler:     (_err) => { /* keep emit pipeline alive on bad mutations */ },
};

/**
 * Whether this visitor should ship rrweb rows into `session` (replay).
 */
const computeReplaySessionEnabled = () => {
  const replayOn = cfg.replay_enabled !== false && cfg.recording !== false;
  if (!replayOn) return false;
  const samplingRate = typeof cfg.replay_sampling_rate === 'number' ? cfg.replay_sampling_rate : 1.0;
  if (samplingRate < 1.0 && Math.random() > samplingRate) return false;
  const includePatterns = cfg.replay_include_patterns;
  const excludePatterns = cfg.replay_exclude_patterns;
  if (hasEffectivePatterns(includePatterns) && !matchesPatterns(includePatterns)) return false;
  if (hasEffectivePatterns(excludePatterns) && matchesPatterns(excludePatterns)) return false;
  return true;
};

/** Start (or restart) rrweb under the given session ID and attach to the global stop handle. */
const startRrweb = (record, sid, recordSession) => {
  if (stopRecording) {
    try { stopRecording(); } catch { /* ignore */ }
    stopRecording = null;
  }
  activeRecordingSessionId = sid;
  const stop = record({
    ...RRWEB_OPTIONS,
    emit(event) {
      mirrorHeatmapFromRrweb(event);
      if (recordSession) {
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
  const replayOn = cfg.replay_enabled !== false && cfg.recording !== false;
  if (!replayOn) return;

  const recordSession = computeReplaySessionEnabled();
  if (!recordSession) return;

  const record = await loadRrweb();
  if (!record) return;

  startRrweb(record, getSessionId(), recordSession);
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const utmParams = () => {
  const p = new URLSearchParams(location.search), out = {};
  for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
    const v = p.get('utm_' + k);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
};

const deviceInfo = () => ({
  ua:   navigator.userAgent,
  lang: navigator.language,
  sw:   screen.width,  sh: screen.height,
  vw:   innerWidth,    vh: innerHeight,
  dpr:  devicePixelRatio ?? 1,
  tz:   Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? '',
});

// ─── Page tracking ────────────────────────────────────────────────────────────
const trackPage = () => {
  heatmapScrollMax = 0;
  heatmapScrollThrottleAt = 0;
  heatmapMouseMoveThrottleAt = 0;
  lastPointerDocForHeatmap = null;
  const utm = utmParams();
  pushAnalytics('pageview', {
    title: document.title, referrer: document.referrer,
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
// Persist funnel progress in sessionStorage so a mid-funnel refresh doesn't reset state.
const _fsFsKey  = (fid) => `snc_fs:${websiteId}:${fid}`;
const _loadFs   = (fid) => {
  try { const v = sessionStorage.getItem(_fsFsKey(fid)); return v != null ? { step: parseInt(v, 10) || 0 } : null; } catch { return null; }
};
const _saveFs   = (fid, step) => { try { sessionStorage.setItem(_fsFsKey(fid), String(step)); } catch {} };

const funnelState = {};

/** Emit funnel_step (and funnel_complete when last step reached) then persist state. */
const _advanceFs = (f, state, stepName, path) => {
  pushAnalytics('funnel_step', { funnel_id: f.id, name: f.name, step: state.step, step_name: stepName, path });
  state.step++;
  if (state.step >= (f.steps ?? []).length) {
    pushAnalytics('funnel_complete', { funnel_id: f.id, name: f.name });
    state.step = 0;
  }
  _saveFs(f.id, state.step);
};

/** Called on every SPA page navigation — evaluates page_view-type funnel steps. */
const evalFunnels = (path) => {
  for (const f of funnels) {
    const steps = f.steps ?? [];
    if (!steps.length) continue;
    const state = funnelState[f.id] ?? (funnelState[f.id] = _loadFs(f.id) ?? { step: 0 });
    const next  = steps[state.step];
    if (!next) continue;
    const stepType = next.step_type ?? next.stepType ?? 'page_view';
    if (stepType !== 'page_view') continue; // event steps handled by evalFunnelsForEvent
    const pagePath  = next.page_path ?? next.path;
    const matchType = next.match_type ?? next.matchType ?? 'exact';
    let hit = false;
    if (pagePath) {
      if (matchType === 'contains')         hit = path.includes(pagePath);
      else if (matchType === 'starts_with') hit = path.startsWith(pagePath);
      else if (matchType === 'regex')       hit = safeRegex(pagePath, path);
      else                                  hit = path === pagePath;
    } else if (next.pattern) {
      hit = safeRegex(next.pattern, path);
    }
    if (hit) _advanceFs(f, state, next.name, path);
  }
};

/** Called from seentics.track() — evaluates event-type funnel steps. */
const evalFunnelsForEvent = (eventName) => {
  for (const f of funnels) {
    const steps = f.steps ?? [];
    if (!steps.length) continue;
    const state = funnelState[f.id] ?? (funnelState[f.id] = _loadFs(f.id) ?? { step: 0 });
    const next  = steps[state.step];
    if (!next) continue;
    const stepType = next.step_type ?? next.stepType ?? 'page_view';
    if (stepType !== 'event') continue;
    const target = next.event_type ?? next.eventType ?? '';
    if (target && target === eventName) _advanceFs(f, state, next.name, location.pathname);
  }
};

// ─── Exit-intent trigger ──────────────────────────────────────────────────────
let _exitIntentCooldown = false;
const _installExitIntent = () => {
  document.addEventListener('mouseleave', (e) => {
    if (e.clientY > 0) return;          // cursor must leave through the top edge
    if (_exitIntentCooldown) return;
    _exitIntentCooldown = true;
    evalAutomations('exit_intent', { path: location.pathname });
    setTimeout(() => { _exitIntentCooldown = false; }, 30_000); // 30 s cool-down
  });
};

// ─── Inactivity trigger ───────────────────────────────────────────────────────
const _INACTIVITY_MS = 30_000;
let _inactivityTimer = null;
let _inactivityInstalled = false;
const _resetInactivityTimer = () => {
  if (_inactivityTimer) clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    evalAutomations('inactivity', { path: location.pathname, inactivity_ms: _INACTIVITY_MS });
    _inactivityTimer = null;
  }, _INACTIVITY_MS);
};
const _installInactivity = () => {
  if (_inactivityInstalled) return;
  _inactivityInstalled = true;
  for (const ev of ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']) {
    window.addEventListener(ev, _resetInactivityTimer, { passive: true });
  }
  _resetInactivityTimer();
};

// ─── Automations ──────────────────────────────────────────────────────────────
const evalAutomations = (event, props) => {
  for (const a of automations) {
    const tr = a.trigger;
    if (!tr || tr.event !== event) continue;
    const ok = (tr.conditions ?? []).every((c) => {
      const v = props[c.field];
      if (c.op === 'eq')       return v === c.value;
      if (c.op === 'neq')      return v !== c.value;
      if (c.op === 'contains') return v != null && String(v).includes(c.value);
      if (c.op === 'regex')    return v != null && safeRegex(c.value, String(v));
      if (c.op === 'gt')       return +v > +c.value;
      if (c.op === 'lt')       return +v < +c.value;
      return true;
    });
    if (ok) pushAnalytics('automation_trigger', { automation_id: a.id, name: a.name, event, props });
  }
};

// ─── Performance ──────────────────────────────────────────────────────────────
const trackPerf = () => {
  const entries = performance?.getEntriesByType?.('navigation');
  const t = entries?.[0];
  if (!t?.loadEventEnd) return;
  pushAnalytics('performance', {
    load:    Math.round(t.loadEventEnd),
    dom:     Math.round(t.domContentLoadedEventEnd),
    ttfb:    Math.round(t.responseStart),
    dns:     Math.round(t.domainLookupEnd - t.domainLookupStart),
    connect: Math.round(t.connectEnd   - t.connectStart),
    render:  Math.round(t.loadEventEnd - t.responseEnd),
  });
};

// ─── SPA routing ──────────────────────────────────────────────────────────────
const initRouting = () => {
  let lastPath = location.pathname;
  const onNav = () => {
    if (location.pathname === lastPath) return;
    clearHeatmapScreenshotRefreshTimers();
    lastPath = location.pathname;
    if (autoTrack) trackPage();
    window.setTimeout(requestRrwebFullSnapshotForNavigation, 50);
    if (cfg.heatmap_layout_enabled !== false) {
      scheduleHeatmapScreenshotAfterAppIdle();
    }
  };
  window.addEventListener('popstate', onNav);
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m].bind(history);
    history[m] = (...a) => { orig(...a); onNav(); };
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
const init = () => {
  if (!websiteId) return;
  initRouting();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBeacon();
  });
  window.addEventListener('pagehide', flushBeacon);

  fetch(apiHost + '/api/v1/tracker/init/' + websiteId)
    .then(async (r) => {
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.warn('[Seentics] tracker init failed:', r.status, r.statusText, t?.slice?.(0, 200) ?? '');
        throw new Error('tracker init failed');
      }
      return r.json();
    })
    .then(async (d) => {
      cfg         = d.config      ?? {};
      funnels     = d.funnels     ?? [];
      automations = d.automations ?? [];
      if (autoTrack) trackPage();
      if (cfg.replay_enabled !== false && cfg.recording !== false) {
        installSessionClientErrorCapture();
      }
      if (cfg.replay_enabled !== false && cfg.recording !== false) {
        await initRecording();
      }
      if (cfg.heatmap_layout_enabled !== false) {
        scheduleHeatmapScreenshotAfterAppIdle();
      }
      installHeatmapCapture();
      _installExitIntent();
      _installInactivity();
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
      flush(); // first load: send pageview + rrweb snapshot immediately
      flushInterval = window.setInterval(flush, FLUSH_MS);
    })
    .catch(() => {
      console.warn(
        '[Seentics] tracker running in degraded mode (no session recording). ' +
          'Fix init URL/domain: data-api-host should reach your API (e.g. same origin as this app in dev).',
      );
      if (autoTrack) trackPage();
      installHeatmapCapture();
      _installExitIntent();
      _installInactivity();
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
      flush();
      flushInterval = window.setInterval(flush, FLUSH_MS);
    });
};

// ─── Public API ───────────────────────────────────────────────────────────────
window.seentics = {
  track: (name, props) => {
    pushAnalytics('custom', { name, ...(props ?? {}) });
    evalFunnelsForEvent(name);
    evalAutomations('custom', { name, ...(props ?? {}) });
  },
  identify: (userId, traits) => {
              getStore()?.setItem('snc_vid', userId);
              visitorId = userId;
              pushAnalytics('identify', { user_id: userId, traits: traits ?? {} });
            },
  page:  trackPage,
  flush: flushAnalytics,
};

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
