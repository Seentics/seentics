/*!
 * Seentics Tracker v2 — analytics, session recording, funnels & automations
 * Recording: rrweb (lazy-loaded after init) + gzip compression + batching
 * Analytics:  batched, sendBeacon, single /collect endpoint
 */

const script = document.currentScript as HTMLScriptElement | null;
const siteId = script?.getAttribute('data-website-id') ?? '';

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

const COLLECT   = apiHost + '/api/v1/tracker/collect';
const MAX_BATCH = 25;    // analytics events before forced flush
const FLUSH_MS  = 5000;  // flush interval — 5 s
const REC_MAX   = 150;   // rrweb events before early flush

// ─── State ────────────────────────────────────────────────────────────────────
let cfg:         Record<string, unknown> = {};
let funnels:     any[]                   = [];
let automations: any[]                   = [];
let analyticsTimer: number | null        = null;

const queues = {
  events:      [] as any[],
  funnels:     [] as any[],
  automations: [] as any[],
  session:     [] as any[],   // rrweb eventWithTime wrapped in TrackerEvent envelope
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

const visitorId: string = (() => {
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
  let id  = s.getItem('snc_sid');
  const exp = s.getItem('snc_se');
  if (!id || !exp || Date.now() > +exp) {
    id = 's-' + rnd() + Date.now().toString(36);
    s.setItem('snc_sid', id);
  }
  s.setItem('snc_se', String(Date.now() + 1_800_000)); // rolling 30 min
  return id;
};

// ─── Queue helpers ────────────────────────────────────────────────────────────
const categoryOf = (type: string): keyof typeof queues => {
  if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
  if (type === 'automation_trigger')                        return 'automations';
  return 'events';
};

const pushAnalytics = (type: string, data: Record<string, unknown>): void => {
  const cat = categoryOf(type);
  queues[cat].push({ type, data, ts: Date.now(), url: location.href, sid: getSessionId(), vid: visitorId });
  const analyticsTotal = queues.events.length + queues.funnels.length + queues.automations.length;
  if (analyticsTotal >= MAX_BATCH) flush();
  else if (!analyticsTimer) analyticsTimer = window.setTimeout(flush, FLUSH_MS);
};

// ─── Unified flush — sends all queues to /collect in one request ──────────────
const flush = (): void => {
  const e = queues.events.splice(0);
  const f = queues.funnels.splice(0), a = queues.automations.splice(0);
  const s = queues.session.splice(0);
  if (!e.length && !f.length && !a.length && !s.length) return;
  clearTimeout(analyticsTimer!); analyticsTimer = null;

  const payload: Record<string, unknown> = { site_id: siteId, domain };
  if (e.length) payload.events      = e;
  if (f.length) payload.funnels     = f;
  if (a.length) payload.automations = a;
  if (s.length) payload.session     = s;

  const json = JSON.stringify(payload);

  // When recording events are present, use XHR with gzip (sendBeacon has a ~64 KB limit)
  if (s.length > 0) {
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
const matchesPatterns = (patterns: string | null | undefined): boolean => {
  if (!patterns) return false;
  const list = patterns.split('\n').map(p => p.trim()).filter(Boolean);
  if (!list.length) return false;
  const url = location.href;
  return list.some(p => safeRegex(p, url));
};

const initRecording = async (): Promise<void> => {
  const samplingRate = typeof cfg.replay_sampling_rate === 'number'
    ? (cfg.replay_sampling_rate as number)
    : 1.0;
  if (samplingRate < 1.0 && Math.random() > samplingRate) return;

  const includePatterns = cfg.replay_include_patterns as string | null | undefined;
  const excludePatterns = cfg.replay_exclude_patterns as string | null | undefined;
  if (includePatterns && !matchesPatterns(includePatterns)) return;
  if (excludePatterns && matchesPatterns(excludePatterns)) return;

  // Load rrweb lazily — only at this point do we know recording is needed.
  const record = await loadRrweb();
  if (!record) return;

  record({
    emit(event: any) {
      const sid = getSessionId();
      queues.session.push({
        type: 'rrweb',
        data: event,           // full rrweb eventWithTime: {type, timestamp, data}
        ts:   event.timestamp,
        url:  location.href,
        sid,
        vid:  visitorId,
      });
      if (queues.session.length >= REC_MAX) flush();
      else if (!analyticsTimer) analyticsTimer = window.setTimeout(flush, FLUSH_MS);
    },
    // Full snapshot every 2 min limits incremental drift so replay stays in sync
    // (reduces “Node with id … not found” / mutation errors on long sessions).
    checkoutEveryNms: 120_000,
    // Privacy: mask ALL inputs by default.
    // Users can add data-seentics-block to hide elements from the recording entirely.
    maskAllInputs:  true,
    blockSelector:  '[data-seentics-block]',
    ignoreSelector: '[data-seentics-ignore]',
    // Performance sampling
    sampling: {
      mousemove: 50,   // ~20 fps mouse tracking
      scroll:    150,
      media:     800,
      input:     'last',
    },
    inlineStylesheet: true,   // accurate CSS replay
    collectFonts:     false,
    recordCanvas:     false,
  });
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
  if (!siteId) return;
  initRouting();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  fetch(apiHost + '/api/v1/tracker/init/' + siteId)
    .then(r => r.json())
    .then((d: any) => {
      cfg         = d.config      ?? {};
      funnels     = d.funnels     ?? [];
      automations = d.automations ?? [];
      if (autoTrack)               trackPage();
      if (cfg.recording !== false) initRecording(); // async — loads rrweb lazily
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
    })
    .catch(() => {
      if (autoTrack) trackPage();
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
    });
};

// ─── Public API ───────────────────────────────────────────────────────────────
(window as any).seentics = {
  track:    (name: string, props?: Record<string, unknown>) =>
              pushAnalytics('custom', { name, ...(props ?? {}) }),
  identify: (userId: string, traits?: Record<string, unknown>) => {
              getStore()?.setItem('snc_vid', userId);
              pushAnalytics('identify', { user_id: userId, traits: traits ?? {} });
            },
  page:  trackPage,
  flush: flushAnalytics,
};

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
