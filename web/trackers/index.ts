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
const apiHost = normalizeApiBase(script?.getAttribute('data-api-host') ?? 'https://api.seentics.com');
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
  events:      [] as any[],
  funnels:     [] as any[],
  automations: [] as any[],
  session:     [] as any[],   // rrweb eventWithTime wrapped in TrackerEvent envelope
  heatmaps:    [] as any[],   // heatmap_click / heatmap_scroll for /collect heatmaps
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
        if (record) startRrweb(record, currentSid);
      });
    }
  }

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

// ─── rrweb lazy loader ────────────────────────────────────────────────────────
// rrweb.js is loaded on demand — only when session recording is actually needed.
// It sets window.__rrweb_record = record after loading.
type RrwebRecord = (options: Record<string, unknown>) => () => void;
let _rrwebPromise: Promise<RrwebRecord | null> | null = null;

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

const loadRrweb = (): Promise<RrwebRecord | null> => {
  if (_rrwebPromise) return _rrwebPromise;
  _rrwebPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.__rrweb_record) { resolve(w.__rrweb_record); return; }
    if (!rrwebSrc)        { resolve(null); return; }
    const s    = document.createElement('script');
    s.src      = rrwebSrc;
    s.onload   = () => resolve(w.__rrweb_record ?? null);
    s.onerror  = () => resolve(null);
    document.head.appendChild(s);
  });
  return _rrwebPromise;
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
/** Max scroll depth on the current page URL (reset in trackPage). */
let heatmapScrollMax = 0;

const installHeatmapCapture = (): void => {
  if (heatmapListenersInstalled) return;
  // Hard-off only; include/exclude patterns are evaluated per-event so SPA navigations can enable later.
  if (cfg.heatmap_enabled === false) return;
  heatmapListenersInstalled = true;

  document.addEventListener('click', (ev: MouseEvent) => {
    if (!heatmapAllowed()) return;
    const t = ev.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-seentics-block]')) return;
    const vw = innerWidth || 1;
    const vh = innerHeight || 1;
    queues.heatmaps.push({
      type: 'heatmap_click',
      data: {
        nx: ev.clientX / vw,
        ny: ev.clientY / vh,
        target: heatmapSelectorHint(t),
      },
      ts: Date.now(),
      url: location.href,
      sid: getSessionId(),
      vid: visitorId,
    });
  }, true);

  let scrollFireAt = 0;
  const onScroll = (): void => {
    if (!heatmapAllowed()) return;
    const d = scrollDepth01();
    if (d > heatmapScrollMax) heatmapScrollMax = d;
    const now = Date.now();
    if (now - scrollFireAt < 450) return;
    scrollFireAt = now;
    queues.heatmaps.push({
      type: 'heatmap_scroll',
      data: { depth: heatmapScrollMax },
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
  // Full snapshot periodically limits incremental drift ("node not found" / bad mirrors).
  checkoutEveryNms: 90_000,
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
  collectFonts:     false,
  recordCanvas:     false,
  errorHandler:     (_err: unknown) => { /* keep emit pipeline alive on bad mutations */ },
};

/** Start (or restart) rrweb under the given session ID and attach to the global stop handle. */
const startRrweb = (record: RrwebRecord, sid: string): void => {
  if (stopRecording) {
    try { stopRecording(); } catch { /* ignore */ }
    stopRecording = null;
  }
  activeRecordingSessionId = sid;
  const stop = record({
    ...RRWEB_OPTIONS,
    emit(event: any) {
      queues.session.push({
        type: 'rrweb',
        data: event,
        ts:   event.timestamp,
        url:  location.href,
        sid:  activeRecordingSessionId!,
        vid:  visitorId,
      });
    },
  });
  // rrweb record() returns a stop function in some versions, undefined in others.
  if (typeof stop === 'function') stopRecording = stop;
};

const initRecording = async (): Promise<void> => {
  if (cfg.replay_enabled === false) return;

  const samplingRate = typeof cfg.replay_sampling_rate === 'number'
    ? (cfg.replay_sampling_rate as number)
    : 1.0;
  if (samplingRate < 1.0 && Math.random() > samplingRate) return;

  const includePatterns = cfg.replay_include_patterns as string | null | undefined;
  const excludePatterns = cfg.replay_exclude_patterns as string | null | undefined;
  if (hasEffectivePatterns(includePatterns) && !matchesPatterns(includePatterns)) return;
  if (hasEffectivePatterns(excludePatterns) && matchesPatterns(excludePatterns)) return;

  const record = await loadRrweb();
  if (!record) return;

  startRrweb(record, getSessionId());
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
    lastPath = location.pathname;
    if (autoTrack) trackPage();
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
      // Server sends replay_enabled; legacy key recording also supported.
      if (cfg.replay_enabled !== false && cfg.recording !== false) {
        installSessionClientErrorCapture();
        await initRecording(); // await so first flush includes rrweb snapshot
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
