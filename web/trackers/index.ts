/*!
 * Seentics Tracker v2 — analytics, session recording, funnels & automations
 * Recording: rrweb (lazy-loaded after init) + gzip compression + batching
 * Analytics:  batched, sendBeacon, single /collect endpoint
 */

const script = document.currentScript as HTMLScriptElement | null;
/** Website UUID — same value as the dashboard project id (data-website-id). */
const websiteId = script?.getAttribute('data-website-id') ?? '';

/** Strip trailing /api/v1 so COLLECT = origin + '/api/v1/tracker/collect' never doubles the prefix. */
function normalizeApiBase(raw: string): string {
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
function defaultApiHostFromScript(): string {
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

const apiHost = normalizeApiBase(script?.getAttribute('data-api-host') ?? defaultApiHostFromScript());
const autoTrack = script?.getAttribute('data-auto-track') !== 'false';
const domain    = window.location.hostname;

// rrweb.js lives next to seentics.js; override via data-rrweb-src if needed.
const _scriptSrc = script?.src ?? '';
const rrwebSrc: string =
  script?.getAttribute('data-rrweb-src') ??
  (_scriptSrc ? _scriptSrc.replace(/[^/?#]*\.js[^/]*$/, 'rrweb.js') : '');

const COLLECT       = apiHost + '/api/v1/tracker/collect';
const FLUSH_MS      = 10_000;           // 10 s periodic flush interval
const SESSION_MAX_MS = 30 * 60 * 1000; // 30 min hard session cap

// ─── State ────────────────────────────────────────────────────────────────────
let cfg:         Record<string, unknown> = {};
let funnels:     any[]                   = [];
let automations: any[]                   = [];
let flushInterval: number | null = null;

const queues = {
  events:          [] as any[],
  funnels:         [] as any[],
  automations:     [] as any[],
  session:         [] as any[],   // rrweb eventWithTime wrapped in TrackerEvent envelope
  heatmaps:            [] as any[],   // heatmap_click / heatmap_scroll for /collect heatmaps
  heatmap_screenshot:  [] as any[],   // html2canvas JPEG (base64 in data.image) for heatmap underlay
};

// ─── Visitor / Session IDs ────────────────────────────────────────────────────
const getStore = (): Storage | null => { try { return localStorage; } catch { return null; } };

// Cryptographically random token; falls back to Math.random if unavailable.
const rnd = (): string => {
  try {
    const arr = new Uint8Array(9);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(36)).join('');
  } catch {
    return Math.random().toString(36).slice(2, 11);
  }
};

let visitorId: string = (() => {
  const s = getStore();
  if (!s) return 'v-' + rnd();
  let id = s.getItem('snc_vid');
  if (!id) {
    id = 'v-' + rnd() + Date.now().toString(36);
    s.setItem('snc_vid', id);
  }
  return id;
})();

const getSessionId = (): string => {
  const s = getStore();
  if (!s) return 's-' + Date.now().toString(36);
  const now  = Date.now();
  let id     = s.getItem('snc_sid');
  const exp  = s.getItem('snc_se');   // inactivity expiry
  const ss   = s.getItem('snc_ss');   // session start time (for hard cap)

  const inactivityExpired = !id || !exp || now > +exp;
  const hardCapExceeded   = !!ss && (now - +ss) >= SESSION_MAX_MS;

  if (inactivityExpired || hardCapExceeded) {
    id = 's-' + rnd() + now.toString(36);
    s.setItem('snc_sid', id);
    s.setItem('snc_ss', String(now));
  }
  s.setItem('snc_se', String(now + SESSION_MAX_MS));
  return id!;
};

// ─── Queue helpers ────────────────────────────────────────────────────────────
const categoryOf = (type: string): keyof typeof queues => {
  if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
  if (type === 'automation_trigger')                        return 'automations';
  if (type === 'heatmap_click' || type === 'heatmap_scroll') return 'heatmaps';
  return 'events';
};

const pushAnalytics = (type: string, data: Record<string, unknown>): void => {
  queues[categoryOf(type)].push({ type, data, ts: Date.now(), url: location.href, sid: getSessionId(), vid: visitorId });
};

// Gzip via native CompressionStream; falls back to plain JSON if unavailable.
const sendGzip = async (json: string): Promise<void> => {
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

/**
 * Screenshots must not share a /collect body with huge `session` rrweb batches — proxies truncate → unexpected EOF.
 * POST heatmap_screenshot alone. Normal flushes use gzip; page-unload uses sync plain JSON (CompressionStream is async).
 */
const flushHeatmapScreenshotsDedicated = (syncUnload: boolean): void => {
  const shot = queues.heatmap_screenshot.splice(0);
  if (!shot.length) return;
  const payload = JSON.stringify({
    website_id: websiteId,
    domain,
    heatmap_screenshot: shot,
  });
  if (syncUnload) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', COLLECT, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    } catch {
      /* ignore */
    }
    return;
  }
  void sendGzip(payload);
};

// ─── Unified flush — sends all queues to /collect in one request ──────────────
const flush = (): void => {
  // Session hard-cap check: if the session rotated since we last started rrweb,
  // restart recording so the new session gets a fresh FullSnapshot baseline.
  if (activeRecordingSessionId !== null) {
    const currentSid = getSessionId();
    if (currentSid !== activeRecordingSessionId) {
      // Flush whatever was buffered under the old session first (handled below).
      // Then restart rrweb for the new session — the initial FullSnapshot lands
      // in the next flush cycle 10 s later.
      loadRrweb().then(record => {
        if (record) startRrweb(record, currentSid, computeReplaySessionEnabled());
      });
    }
  }

  flushHeatmapScreenshotsDedicated(false);

  const e = queues.events.splice(0);
  const f = queues.funnels.splice(0), a = queues.automations.splice(0);
  const s = queues.session.splice(0);
  const h = queues.heatmaps.splice(0);
  if (!e.length && !f.length && !a.length && !s.length && !h.length) return;

  const payload: Record<string, unknown> = { website_id: websiteId, domain };
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
const flushBeacon = (): void => {
  flushHeatmapScreenshotsDedicated(true);

  const e = queues.events.splice(0);
  const f = queues.funnels.splice(0), a = queues.automations.splice(0);
  const s = queues.session.splice(0);
  const h = queues.heatmaps.splice(0);
  if (!e.length && !f.length && !a.length && !s.length && !h.length) return;

  const payload: Record<string, unknown> = { website_id: websiteId, domain };
  if (e.length) payload.events      = e;
  if (f.length) payload.funnels     = f;
  if (a.length) payload.automations = a;
  if (s.length) payload.session     = s;
  if (h.length) payload.heatmaps    = h;
  const json = JSON.stringify(payload);
  if (s.length > 0 || h.length > 400 || json.length > 55_000) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', COLLECT, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(json);
    } catch { /* ignore */ }
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon && navigator.sendBeacon(COLLECT, blob)) return;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', COLLECT, false); // synchronous
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(json);
  } catch { /* ignore — page is already closing */ }
};

// ─── rrweb lazy loader ────────────────────────────────────────────────────────
// rrweb.js is loaded on demand — only when session recording is actually needed.
// It sets window.__rrweb_record = record after loading.
/** rrweb `record` function; `takeFullSnapshot` is on the same fn (see rrweb-loader). */
type RrwebRecord = (options: Record<string, unknown>) => void | (() => void);
type RrwebModule = RrwebRecord & { takeFullSnapshot?: (isCheckout?: boolean) => void };
let _rrwebPromise: Promise<RrwebModule | null> | null = null;

/** Capture window errors + unhandled rejections for replay session metadata. */
const installSessionClientErrorCapture = (): void => {
  const w = window as unknown as { __snc_err_cap?: boolean };
  if (w.__snc_err_cap) return;
  w.__snc_err_cap = true;

  const enqueue = (data: Record<string, unknown>) => {
    queues.session.push({
      type: 'session_error',
      data,
      ts:  Date.now(),
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  };

  window.addEventListener('error', (ev: ErrorEvent) => {
    enqueue({
      message:  ev.message  || 'Script error',
      filename: ev.filename || undefined,
      lineno:   ev.lineno   || undefined,
      colno:    ev.colno    || undefined,
      stack:    (ev.error as Error | null)?.stack || undefined,
    });
  }, true);

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    const isErr  = reason instanceof Error;
    enqueue({
      message: isErr ? reason.message : String(reason ?? 'Unhandled rejection'),
      stack:   isErr ? reason.stack   : undefined,
    });
  });
};

const loadRrweb = (): Promise<RrwebModule | null> => {
  if (_rrwebPromise) return _rrwebPromise;
  _rrwebPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.__rrweb_record) { resolve(w.__rrweb_record as RrwebModule); return; }
    if (!rrwebSrc)        { resolve(null); return; }
    const s    = document.createElement('script');
    s.src      = rrwebSrc;
    s.onload   = () => resolve((w.__rrweb_record ?? null) as RrwebModule | null);
    s.onerror  = () => resolve(null);
    document.head.appendChild(s);
  });
  return _rrwebPromise;
};

/**
 * Per-tab, per path: one heatmap screenshot upload per pathname until navigation (saves bandwidth).
 */
const heatmapScreenshotSentKey = (): string => {
  if (!websiteId) return '';
  try {
    return `snc_hmshot:${websiteId}:${location.pathname}`;
  } catch {
    return '';
  }
};

const hasSentHeatmapScreenshotForPath = (): boolean => {
  const k = heatmapScreenshotSentKey();
  if (!k) return false;
  try {
    return sessionStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};

const markHeatmapScreenshotSentForPath = (): void => {
  const k = heatmapScreenshotSentKey();
  if (!k) return;
  try {
    sessionStorage.setItem(k, '1');
  } catch {
    /* ignore */
  }
};

/** Timeouts for post-load / post-nav screenshots (cleared on navigation). */
let heatmapScreenshotRefreshTimeouts: number[] = [];
let heatmapScreenshotLongPageInterval: number | null = null;

const clearHeatmapScreenshotRefreshTimers = (): void => {
  for (const id of heatmapScreenshotRefreshTimeouts) {
    window.clearTimeout(id);
  }
  heatmapScreenshotRefreshTimeouts = [];
};

const clearHeatmapScreenshotLongPageInterval = (): void => {
  if (heatmapScreenshotLongPageInterval != null) {
    window.clearInterval(heatmapScreenshotLongPageInterval);
    heatmapScreenshotLongPageInterval = null;
  }
};

/** SPA / replay: ask rrweb for a fresh full snapshot when recording (checkout drift), not for heatmap JPEGs. */
const requestRrwebFullSnapshotForNavigation = (): void => {
  const rec = (window as unknown as { __rrweb_record?: RrwebModule }).__rrweb_record;
  if (!rec?.takeFullSnapshot) return;
  try {
    rec.takeFullSnapshot(false);
  } catch {
    /* not recording yet */
  }
};

/** Keep screenshots small so /collect JSON is not truncated by proxies (base64 inflates ~33%). */
const HEATMAP_SCREENSHOT_MAX_EDGE = 1440;
const HEATMAP_SCREENSHOT_JPEG_QUALITY = 0.68;
/** Drop if still too large after scale/quality (avoids broken JSON / unexpected EOF upstream). */
const HEATMAP_SCREENSHOT_MAX_B64 = 2_200_000;
/** Skip capture on paths that are almost certainly the Seentics dashboard (avoids freezing when self-tracking). */
const shouldSkipHeatmapScreenshotForPath = (): boolean => {
  try {
    const p = location.pathname;
    if (p.startsWith('/websites/')) return true;
    if (p.startsWith('/preview/')) return true;
    return false;
  } catch {
    return false;
  }
};
/** html2canvas on documents larger than this is likely to freeze the main thread. */
const HEATMAP_SCREENSHOT_MAX_DOC_EDGE = 14_000;

/**
 * Full-page JPEG via html2canvas (same scroll-box basis as heatmap_click nx/ny).
 */
const captureAndQueueHeatmapScreenshot = (): void => {
  if (cfg.heatmap_layout_enabled === false) return;
  if (shouldSkipHeatmapScreenshotForPath()) return;
  if (hasSentHeatmapScreenshotForPath()) return;
  void (async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      heatmapMetricsCache = null;
      const { dw, dh } = heatmapDocumentMetrics();
      if (
        dw > HEATMAP_SCREENSHOT_MAX_DOC_EDGE ||
        dh > HEATMAP_SCREENSHOT_MAX_DOC_EDGE ||
        dw * dh > HEATMAP_SCREENSHOT_MAX_DOC_EDGE * 8_000
      ) {
        return;
      }
      const el = document.documentElement;
      const longEdge = Math.max(dw, dh, 1);
      const scale = Math.min(1, HEATMAP_SCREENSHOT_MAX_EDGE / longEdge);
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/jpeg', HEATMAP_SCREENSHOT_JPEG_QUALITY);
      const b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      if (!b64 || b64.length < 200 || b64.length > HEATMAP_SCREENSHOT_MAX_B64) return;
      queues.heatmap_screenshot.push({
        type: 'heatmap_screenshot',
        data: { image: b64 },
        ts: Date.now(),
        url: location.href,
        sid: getSessionId(),
        vid: visitorId,
        doc_w: Math.max(1, Math.round(dw)),
        doc_h: Math.max(1, Math.round(dh)),
      });
      markHeatmapScreenshotSentForPath();
      flushHeatmapScreenshotsDedicated(false);
      flush();
    } catch {
      /* cross-origin assets / huge DOM — skip silently */
    }
  })();
};

/**
 * After load or SPA navigation, delayed captures catch hydration / lazy routes.
 * Long sessions: periodic refresh so the stored image is not stale forever.
 */
const scheduleHeatmapScreenshotAfterAppIdle = (): void => {
  if (cfg.heatmap_layout_enabled === false) return;
  clearHeatmapScreenshotRefreshTimers();
  const run = (): void => {
    try {
      sessionStorage.removeItem(heatmapScreenshotSentKey());
    } catch {
      /* ignore */
    }
    captureAndQueueHeatmapScreenshot();
  };
  const delaysMs = [900, 2_500, 6_000];
  for (const ms of delaysMs) {
    heatmapScreenshotRefreshTimeouts.push(window.setTimeout(run, ms));
  }

  clearHeatmapScreenshotLongPageInterval();
  heatmapScreenshotLongPageInterval = window.setInterval(() => {
    if (cfg.heatmap_layout_enabled === false) return;
    run();
  }, 90_000);
};

// ─── Safe regex — guards against ReDoS ───────────────────────────────────────
// Patterns longer than 500 chars fall back to plain string.includes.
const safeRegex = (pattern: string, subject: string): boolean => {
  if (pattern.length > 500) return subject.includes(pattern);
  try { return new RegExp(pattern).test(subject); } catch { return subject.includes(pattern); }
};

// ─── rrweb recording ──────────────────────────────────────────────────────────
const patternLines = (patterns: string | null | undefined): string[] => {
  if (!patterns) return [];
  return patterns.split('\n').map(p => p.trim()).filter(Boolean);
};

/** True when there is at least one non-empty URL pattern line (after trim). */
const hasEffectivePatterns = (patterns: string | null | undefined): boolean =>
  patternLines(patterns).length > 0;

const matchesPatterns = (patterns: string | null | undefined): boolean => {
  const list = patternLines(patterns);
  if (!list.length) return false;
  const url = location.href;
  return list.some(p => safeRegex(p, url));
};

// ─── Heatmaps (click + scroll depth) ─────────────────────────────────────────
const heatmapAllowed = (): boolean => {
  if (cfg.heatmap_enabled === false) return false;
  const inc = cfg.heatmap_include_patterns as string | null | undefined;
  const exc = cfg.heatmap_exclude_patterns as string | null | undefined;
  // Only enforce include/exclude when there is at least one real pattern line.
  // Otherwise whitespace-only textarea values would block all heatmap capture.
  if (hasEffectivePatterns(inc) && !matchesPatterns(inc)) return false;
  if (hasEffectivePatterns(exc) && matchesPatterns(exc)) return false;
  return true;
};

const scrollDepth01 = (): number => {
  const el = document.documentElement;
  const sh = el.scrollHeight - el.clientHeight;
  if (sh <= 0) return 1;
  return Math.min(1, Math.max(0, el.scrollTop / sh));
};

/** CSS layout viewport (px) at sample time — dashboard sizes the heatmap iframe to match breakpoints. */
const heatmapViewportCss = (): { vw: number; vh: number } => {
  const vv = typeof visualViewport !== 'undefined' && visualViewport ? visualViewport : null;
  const rawW = vv?.width ?? (typeof innerWidth === 'number' ? innerWidth : 0);
  const rawH = vv?.height ?? (typeof innerHeight === 'number' ? innerHeight : 0);
  return {
    vw: Math.max(1, Math.round(rawW)),
    vh: Math.max(1, Math.round(rawH)),
  };
};

/** Last heatmap metric sample (inner scroll scans can be hot during rrweb bursts). */
let heatmapMetricsCache: { at: number; dw: number; dh: number } | null = null;

/**
 * Max layout box: html/body plus any overflow scroll regions (flex dashboards often fix body height
 * and scroll inside `main` / a div — documentElement.scrollHeight stays viewport-sized).
 */
const heatmapDocumentMetrics = (): { dw: number; dh: number } => {
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  if (heatmapMetricsCache && now - heatmapMetricsCache.at < 80) {
    return { dw: heatmapMetricsCache.dw, dh: heatmapMetricsCache.dh };
  }

  const el = document.documentElement;
  const body = document.body;
  // Normalize to the scrollable document box only — do not fold in raw innerWidth/innerHeight as an
  // extra floor (that can inflate dw/dh vs real scrollWidth/scrollHeight and shift nx/ny).
  let dw = Math.max(1, el.scrollWidth, body?.scrollWidth ?? 0, el.clientWidth || 1);
  let dh = Math.max(1, el.scrollHeight, body?.scrollHeight ?? 0, el.clientHeight || 1);

  if (body) {
    try {
      const nodes = body.getElementsByTagName('*');
      const cap = Math.min(nodes.length, 12_000);
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
 * rrweb MouseInteraction / MouseMove only stores **clientX/clientY** (viewport). We previously used
 * `client + window.scroll`, which matches `pageX/pageY` only when the document scrolls on the window.
 * App shells that scroll inside `overflow: auto` regions need ancestor scroll offsets too — same as a
 * real `MouseEvent.pageX/pageY` from the DOM click path.
 */
const rrwebClientToDocumentXY = (clientX: number, clientY: number): { pageX: number; pageY: number } => {
  const docEl = document.documentElement;
  const body = document.body;
  const winX = window.scrollX ?? window.pageXOffset ?? 0;
  const winY = window.scrollY ?? window.pageYOffset ?? 0;
  let pageX = clientX + winX;
  let pageY = clientY + winY;
  try {
    let el: Element | null = document.elementFromPoint(clientX, clientY);
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

const heatmapNormFromPageXY = (pageX: number, pageY: number): { nx: number; ny: number } => {
  const { dw, dh } = heatmapDocumentMetrics();
  return {
    nx: Math.min(1, Math.max(0, pageX / dw)),
    ny: Math.min(1, Math.max(0, pageY / dh)),
  };
};

const heatmapSelectorHint = (el: Element): string => {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id.replace(/\s/g, '')}`;
  if (el.className && typeof el.className === 'string') {
    const c = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    if (c) return `${tag}.${c}`;
  }
  return tag;
};

let heatmapListenersInstalled = false;
/**
 * Last pointerdown (capture). rrweb click incrementals only carry clientX/Y; the browser’s
 * pageX/pageY already include nested scroll offsets — we reuse them when coords line up.
 */
let heatmapPointerBridgeInstalled = false;
let lastPointerDocForHeatmap: {
  pageX: number;
  pageY: number;
  clientX: number;
  clientY: number;
  at: number;
} | null = null;

const installHeatmapPointerPageBridge = (): void => {
  if (heatmapPointerBridgeInstalled) return;
  heatmapPointerBridgeInstalled = true;
  const onPointerDown = (ev: PointerEvent): void => {
    if (cfg.heatmap_enabled === false) return;
    if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen' && ev.pointerType !== 'touch') return;
    lastPointerDocForHeatmap = {
      pageX: ev.pageX,
      pageY: ev.pageY,
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
 * DOM listeners often miss the same interactions on SPAs / shadow-heavy UIs; replay already
 * captures MouseInteraction + Scroll, so heatmaps stay aligned with "sessions work".
 *
 * rrweb: EventType.IncrementalSnapshot = 3; IncrementalSource.MouseMove = 1;
 * MouseInteraction = 2; MouseInteractions.Click = 2; IncrementalSource.Scroll = 3.
 */
const mirrorHeatmapFromRrweb = (ev: any): void => {
  // URL include/exclude applies to DOM listeners only. Replay already decided this page is in scope;
  // if we mirrored heatmapAllowed() here, localhost / dev URLs often fail pattern checks while
  // `session` still fills — looks like "heatmaps not sent to /collect".
  if (cfg.heatmap_enabled === false) return;
  const evType = Number(ev?.type);
  if (evType !== 3) return; // IncrementalSnapshot
  const inner = ev.data;
  if (!inner || typeof inner !== 'object') return;
  const src = Number(inner.source);

  // MouseMove batches (source1) — this is what most /collect `session` payloads are full of.
  // Without mirroring these, users see replay working but `heatmaps` never appears in the wire JSON.
  if (src === 1 && Array.isArray(inner.positions) && inner.positions.length > 0) {
    const now = Date.now();
    if (now - heatmapMouseMoveThrottleAt < 350) return;
    heatmapMouseMoveThrottleAt = now;
    const pos = inner.positions[inner.positions.length - 1] as { x?: unknown; y?: unknown };
    const px = Number(pos.x);
    const py = Number(pos.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    heatmapMetricsCache = null;
    const { pageX, pageY } = rrwebClientToDocumentXY(px, py);
    const { nx, ny } = heatmapNormFromPageXY(pageX, pageY);
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

  // Click (viewport coordinates — same convention as our DOM heatmap listener)
  const miType = Number(inner.type);
  if (src === 2 && miType === 2) {
    const x = Number(inner.x);
    const y = Number(inner.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    heatmapMetricsCache = null;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const bridge = lastPointerDocForHeatmap;
    let pageX: number;
    let pageY: number;
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

  // Scroll depth (use live document metrics; rrweb emits many scroll incrementals)
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

const installHeatmapCapture = (): void => {
  // Hard-off only; include/exclude patterns are evaluated per-event so SPA navigations can enable later.
  if (cfg.heatmap_enabled === false) return;
  installHeatmapPointerPageBridge();
  if (heatmapListenersInstalled) return;
  heatmapListenersInstalled = true;

  document.addEventListener('click', (ev: MouseEvent) => {
    // While rrweb is active, MouseInteraction (Click) is mirrored in emit() — avoids double counts
    // and captures clicks that never reach this capture listener reliably.
    if (stopRecording != null) return;
    if (!heatmapAllowed()) return;
    const t = ev.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-seentics-block]')) return;
    const { nx, ny } = heatmapNormFromPageXY(ev.pageX, ev.pageY);
    const vpC = heatmapViewportCss();
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: {
        nx,
        ny,
        target: heatmapSelectorHint(t),
        vw: vpC.vw,
        vh: vpC.vh,
      },
      ts: Date.now(),
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  }, true);

  const onScroll = (): void => {
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
let stopRecording: (() => void) | null = null;
/** The session ID that the current rrweb instance is recording under. */
let activeRecordingSessionId: string | null = null;

const RRWEB_OPTIONS = {
  // First full snapshot runs after window `load` by default (rrweb recordAfter).
  recordAfter: 'load' as const,
  // Full snapshot periodically limits incremental drift ("node not found" / bad mirrors).
  checkoutEveryNms: 60_000,
  // Privacy: mask ALL inputs by default.
  maskAllInputs:   true,
  blockSelector:   '[data-seentics-block]',
  ignoreSelector:  '[data-seentics-ignore]',
  recordShadowDOM: true,
  sampling: {
    mousemove: 50,   // ~20 fps mouse tracking
    scroll:    150,
    media:     800,
    input:     'last',
  },
  inlineStylesheet: true,
  collectFonts:     true,
  recordCanvas:     true,
  errorHandler:     (_err: unknown) => { /* keep emit pipeline alive on bad mutations */ },
};

/**
 * Whether this visitor should ship rrweb rows into `session` (replay).
 * Heatmap page screenshots use html2canvas separately when `heatmap_layout_enabled`.
 */
const computeReplaySessionEnabled = (): boolean => {
  const replayOn = cfg.replay_enabled !== false && cfg.recording !== false;
  if (!replayOn) return false;
  const samplingRate = typeof cfg.replay_sampling_rate === 'number'
    ? (cfg.replay_sampling_rate as number)
    : 1.0;
  if (samplingRate < 1.0 && Math.random() > samplingRate) return false;
  const includePatterns = cfg.replay_include_patterns as string | null | undefined;
  const excludePatterns = cfg.replay_exclude_patterns as string | null | undefined;
  if (hasEffectivePatterns(includePatterns) && !matchesPatterns(includePatterns)) return false;
  if (hasEffectivePatterns(excludePatterns) && matchesPatterns(excludePatterns)) return false;
  return true;
};

/** Start (or restart) rrweb under the given session ID and attach to the global stop handle. */
const startRrweb = (record: RrwebModule, sid: string, recordSession: boolean): void => {
  if (stopRecording) {
    try { stopRecording(); } catch { /* ignore */ }
    stopRecording = null;
  }
  activeRecordingSessionId = sid;
  const stop = record({
    ...RRWEB_OPTIONS,
    emit(event: any) {
      mirrorHeatmapFromRrweb(event);
      if (recordSession) {
        queues.session.push({
          type: 'rrweb',
          data: event,
          ts:   event.timestamp,
          url:  location.href,
          sid:  activeRecordingSessionId!,
          vid:  visitorId,
        });
      }
    },
  });
  // rrweb record() returns a stop function in some versions, undefined in others.
  if (typeof stop === 'function') stopRecording = stop;
};

const initRecording = async (): Promise<void> => {
  const replayOn = cfg.replay_enabled !== false && cfg.recording !== false;
  if (!replayOn) return;

  const recordSession = computeReplaySessionEnabled();
  if (!recordSession) return;

  const record = await loadRrweb();
  if (!record) return;

  startRrweb(record, getSessionId(), recordSession);
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const utmParams = (): Record<string, string> | null => {
  const p = new URLSearchParams(location.search), out: Record<string, string> = {};
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
const trackPage = (): void => {
  heatmapScrollMax = 0;
  heatmapScrollThrottleAt = 0;
  heatmapMouseMoveThrottleAt = 0;
  lastPointerDocForHeatmap = null;
  const utm = utmParams();
  pushAnalytics('pageview', {
    title: document.title, referrer: document.referrer,
    ...deviceInfo(),
    ...(utm ? { utm } : {}),
  });
  evalFunnels(location.pathname);
  evalAutomations('pageview', { path: location.pathname, title: document.title });
};

// ─── Funnels ──────────────────────────────────────────────────────────────────
const funnelState: Record<string, { step: number }> = {};
const evalFunnels = (path: string): void => {
  for (const f of funnels) {
    const steps: any[] = f.steps ?? [];
    if (!steps.length) continue;
    const state = funnelState[f.id] ?? (funnelState[f.id] = { step: 0 });
    const next = steps[state.step];
    if (!next) continue;
    const hit = next.path ? next.path === path : next.pattern ? safeRegex(next.pattern, path) : false;
    if (!hit) continue;
    pushAnalytics('funnel_step', { funnel_id: f.id, name: f.name, step: state.step, step_name: next.name, path });
    if (++state.step >= steps.length) {
      pushAnalytics('funnel_complete', { funnel_id: f.id, name: f.name });
      state.step = 0;
    }
  }
};

// ─── Automations ──────────────────────────────────────────────────────────────
const evalAutomations = (event: string, props: Record<string, unknown>): void => {
  for (const a of automations) {
    const tr = a.trigger as any;
    if (!tr || tr.event !== event) continue;
    const ok = (tr.conditions ?? []).every((c: any) => {
      const v = props[c.field];
      if (c.op === 'eq')       return v === c.value;
      if (c.op === 'neq')      return v !== c.value;
      if (c.op === 'contains') return v != null && String(v).includes(c.value);
      if (c.op === 'regex')    return v != null && safeRegex(c.value, String(v));
      if (c.op === 'gt')       return +(v as number) > +c.value;
      if (c.op === 'lt')       return +(v as number) < +c.value;
      return true;
    });
    if (ok) pushAnalytics('automation_trigger', { automation_id: a.id, name: a.name, event, props });
  }
};

// ─── Performance ──────────────────────────────────────────────────────────────
const trackPerf = (): void => {
  const entries = performance?.getEntriesByType?.('navigation') as PerformanceNavigationTiming[];
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
const initRouting = (): void => {
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
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = history[m].bind(history);
    (history as any)[m] = (...a: Parameters<typeof history.pushState>) => { orig(...a); onNav(); };
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
const init = (): void => {
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
    .then(async (d: any) => {
      cfg         = d.config      ?? {};
      funnels     = d.funnels     ?? [];
      automations = d.automations ?? [];
      if (autoTrack) trackPage();
      // Session replay and/or heatmap layout snapshots share one rrweb recorder when enabled.
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
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
      flush();
      flushInterval = window.setInterval(flush, FLUSH_MS);
    });
};

// ─── Public API ───────────────────────────────────────────────────────────────
(window as any).seentics = {
  track:    (name: string, props?: Record<string, unknown>) =>
              pushAnalytics('custom', { name, ...(props ?? {}) }),
  identify: (userId: string, traits?: Record<string, unknown>) => {
              getStore()?.setItem('snc_vid', userId);
              visitorId = userId; // update in-memory id so all subsequent events use it
              pushAnalytics('identify', { user_id: userId, traits: traits ?? {} });
            },
  page:  trackPage,
  flush: flushAnalytics,
};

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
