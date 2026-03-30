/*!
 * Seentics Tracker v2 — analytics, heatmaps, session recording, funnels & automations
 * Recording: rrweb (full DOM replay) + gzip compression + batching
 * Analytics:  batched, sendBeacon, single /collect endpoint
 */
import { record } from 'rrweb';

const script    = document.currentScript as HTMLScriptElement | null;
const siteId    = script?.getAttribute('data-website-id') ?? '';
const apiHost   = script?.getAttribute('data-api-host') ?? 'https://api.seentics.com';
const autoTrack = script?.getAttribute('data-auto-track') !== 'false';
const domain    = window.location.hostname;

const COLLECT      = apiHost + '/api/v1/tracker/collect';
const REPLAY       = apiHost + '/api/v1/tracker/replay';
const MAX_BATCH    = 25;    // max analytics events before forced flush
const FLUSH_MS     = 5000;  // analytics queue idle timeout
const REC_BATCH    = 50;    // max rrweb events per gzip chunk
const REC_FLUSH_MS = 2000;  // recording chunk flush interval (2 s = low latency)

// ─── State ────────────────────────────────────────────────────────────────────
let cfg:         Record<string, unknown> = {};
let funnels:     any[]                   = [];
let automations: any[]                   = [];
let analyticsTimer: number | null        = null;

const queues = {
  events:      [] as any[],
  heatmaps:    [] as any[],
  funnels:     [] as any[],
  automations: [] as any[],
};

// ─── Visitor / Session IDs ────────────────────────────────────────────────────
const getStore = (): Storage | null => { try { return localStorage; } catch { return null; } };

const visitorId: string = (() => {
  const s = getStore();
  if (!s) return 'v-' + Math.random().toString(36).slice(2, 11);
  let id = s.getItem('snc_vid');
  if (!id) {
    id = 'v-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
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
    id = 's-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    s.setItem('snc_sid', id);
  }
  s.setItem('snc_se', String(Date.now() + 1_800_000)); // rolling 30 min
  return id;
};

// ─── Analytics queue helpers ──────────────────────────────────────────────────
const categoryOf = (type: string): keyof typeof queues => {
  if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
  if (type === 'automation_trigger')                        return 'automations';
  if (type.startsWith('heatmap_'))                         return 'heatmaps';
  return 'events';
};

const pushAnalytics = (type: string, data: Record<string, unknown>): void => {
  const cat = categoryOf(type);
  queues[cat].push({ type, data, ts: Date.now(), url: location.href, sid: getSessionId(), vid: visitorId });
  const total = queues.events.length + queues.heatmaps.length + queues.funnels.length + queues.automations.length;
  if (total >= MAX_BATCH) flushAnalytics();
  else if (!analyticsTimer) analyticsTimer = window.setTimeout(flushAnalytics, FLUSH_MS);
};

const flushAnalytics = (): void => {
  const e = queues.events.splice(0);
  const h = queues.heatmaps.splice(0);
  const f = queues.funnels.splice(0);
  const a = queues.automations.splice(0);
  if (!e.length && !h.length && !f.length && !a.length) return;
  clearTimeout(analyticsTimer!); analyticsTimer = null;

  const payload: Record<string, unknown> = { site_id: siteId, domain };
  if (e.length) payload.events      = e;
  if (h.length) payload.heatmaps    = h;
  if (f.length) payload.funnels     = f;
  if (a.length) payload.automations = a;

  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });
  if (navigator.sendBeacon) { navigator.sendBeacon(COLLECT, blob); return; }
  const xhr = new XMLHttpRequest();
  xhr.open('POST', COLLECT, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(json);
};

// ─── Recording chunk sender (gzip) ────────────────────────────────────────────
const sendRecordingChunk = async (events: unknown[]): Promise<void> => {
  if (!events.length) return;
  const sid = getSessionId();
  const url = `${REPLAY}?site_id=${encodeURIComponent(siteId)}&session_id=${encodeURIComponent(sid)}&visitor_id=${encodeURIComponent(visitorId)}`;
  const json = JSON.stringify(events);

  // Use native CompressionStream if available (Chrome 80+, Firefox 113+, Safari 16.4+)
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs     = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(new TextEncoder().encode(json));
      writer.close();
      const compressed = await new Response(cs.readable).arrayBuffer();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('Content-Encoding', 'gzip');
      xhr.send(compressed);
      return;
    } catch (_) { /* fall through to uncompressed */ }
  }

  // Fallback: uncompressed JSON
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(json);
};

// ─── rrweb recording ──────────────────────────────────────────────────────────
const initRecording = (): (() => void) | undefined => {
  const batch: unknown[] = [];
  let recTimer: number | null = null;

  const flush = (): void => {
    if (recTimer !== null) { clearTimeout(recTimer); recTimer = null; }
    if (!batch.length) return;
    sendRecordingChunk(batch.splice(0)); // async fire-and-forget
  };

  const stopFn = record({
    emit(event) {
      batch.push(event);
      if (batch.length >= REC_BATCH) {
        flush();
      } else if (recTimer === null) {
        recTimer = window.setTimeout(flush, REC_FLUSH_MS);
      }
    },
    // Privacy
    maskAllInputs:  false,
    maskInputOptions: { password: true },
    blockSelector:  '[data-seentics-block]',
    ignoreSelector: '[data-seentics-ignore]',
    // Performance sampling
    sampling: {
      mousemove: 50,   // ~20fps mouse tracking
      scroll:    150,
      media:     800,
      input:     'last',
    },
    inlineStylesheet: true,   // accurate CSS replay
    collectFonts:     false,  // skip font data to keep chunks small
    recordCanvas:     false,  // canvas recording is expensive; opt-in later
  });

  // Flush on page hide / close
  const onHide = (): void => flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide, { once: true });

  return stopFn;
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const throttle = <T extends unknown[]>(fn: (...args: T) => void, ms: number) => {
  let last = 0;
  let t: number | null = null;
  return function (this: unknown, ...a: T) {
    const now = Date.now(), rem = ms - (now - last);
    if (rem <= 0) { last = now; fn.apply(this, a); }
    else { if (t) clearTimeout(t); t = window.setTimeout(() => { last = Date.now(); fn.apply(this, a); }, rem); }
  };
};

const getSelector = (el: Element | null): string => {
  const parts: string[] = [];
  while (el && el.nodeType === 1 && el !== document.body) {
    let s = el.tagName.toLowerCase();
    if ((el as HTMLElement).id) { parts.unshift(s + '#' + (el as HTMLElement).id); break; }
    const cls = [...(el as HTMLElement).classList].slice(0, 2).join('.');
    if (cls) s += '.' + cls;
    parts.unshift(s);
    el = el.parentElement;
  }
  return parts.slice(-3).join('>') || 'body';
};

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

// ─── Heatmaps ─────────────────────────────────────────────────────────────────
const initHeatmaps = (): void => {
  document.addEventListener('click', (e) => {
    const docH = Math.max(document.body.scrollHeight, 1);
    pushAnalytics('heatmap_click', {
      x:  e.clientX,   y:  e.clientY,
      nx: +(e.clientX / innerWidth).toFixed(4),
      ny: +((e.clientY + scrollY) / docH).toFixed(4),
      target: getSelector(e.target as Element),
      text:   ((e.target as HTMLElement)?.textContent ?? '').trim().slice(0, 60),
    });
  }, { passive: true });

  let maxDepth = 0;
  const MILESTONES = [25, 50, 75, 90, 100];
  window.addEventListener('scroll', throttle(() => {
    const depth = Math.min(100, Math.round((scrollY + innerHeight) / Math.max(document.body.scrollHeight, 1) * 100));
    const hit = MILESTONES.find(m => depth >= m && m > maxDepth);
    if (hit) { maxDepth = hit; pushAnalytics('heatmap_scroll', { depth: hit, path: location.pathname }); }
  }, 300), { passive: true });
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
    const hit = next.path ? next.path === path : next.pattern ? new RegExp(next.pattern).test(path) : false;
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
      if (c.op === 'regex')    return v != null && new RegExp(c.value).test(String(v));
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
    if (document.visibilityState === 'hidden') flushAnalytics();
  });
  window.addEventListener('pagehide', flushAnalytics);

  fetch(apiHost + '/api/v1/tracker/init/' + siteId)
    .then(r => r.json())
    .then((d: any) => {
      cfg         = d.config      ?? {};
      funnels     = d.funnels     ?? [];
      automations = d.automations ?? [];
      if (autoTrack)               trackPage();
      if (cfg.heatmaps  !== false) initHeatmaps();
      if (cfg.recording !== false) initRecording();
      window.addEventListener('load', () => setTimeout(trackPerf, 100));
    })
    .catch(() => {
      if (autoTrack) trackPage();
      initHeatmaps();
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
