/*!
 * Seentics Tracker — analytics, heatmaps, session recording, funnels & automations
 * Single /collect endpoint · batched · privacy-first (no cookies)
 */
(function (window, document) {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const script   = document.currentScript;
  // data-website-id must be the website UUID (same as the dashboard project id).
  const websiteId = script.getAttribute('data-website-id');
  const apiHost  = script.getAttribute('data-api-host') || 'https://api.seentics.com';
  const autoTrack = script.getAttribute('data-auto-track') !== 'false';
  const domain   = window.location.hostname;
  const COLLECT  = apiHost + '/api/v1/tracker/collect';
  const MAX_BATCH = 25;
  const FLUSH_MS  = 5000;

  // ─── State ────────────────────────────────────────────────────────────────
  let cfg = {}, funnels = [], automations = [];
  let timer = null;

  // Per-category queues — flushed as separate payload sections
  const queues = { events: [], session: [], heatmaps: [], funnels: [], automations: [] };

  const categoryOf = (type) => {
    if (type === 'pageview' || type === 'custom' || type === 'identify' || type === 'performance') return 'events';
    if (type === 'funnel_step' || type === 'funnel_complete') return 'funnels';
    if (type === 'automation_trigger') return 'automations';
    if (type.startsWith('heatmap_')) return 'heatmaps';
    if (type.startsWith('rec_')) return 'session';
    return 'events';
  };

  // ─── Storage helpers ──────────────────────────────────────────────────────
  const store = () => { try { return localStorage; } catch (_) { return null; } };

  // Visitor ID — persists across sessions
  const visitorId = (() => {
    const s = store();
    if (!s) return 'v-' + Math.random().toString(36).slice(2, 11);
    let id = s.getItem('snc_vid');
    if (!id) {
      id = 'v-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      s.setItem('snc_vid', id);
    }
    return id;
  })();

  // Session ID — expires after 30 min of inactivity (rolling)
  const sessionId = () => {
    const s = store();
    if (!s) return 's-' + Date.now().toString(36);
    let id  = s.getItem('snc_sid');
    let exp = s.getItem('snc_se');
    if (!id || !exp || Date.now() > +exp) {
      id = 's-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      s.setItem('snc_sid', id);
    }
    s.setItem('snc_se', Date.now() + 1800000); // rolling 30 min
    return id;
  };

  // ─── Batch queue & flush ──────────────────────────────────────────────────
  const push = (type, data) => {
    queues[categoryOf(type)].push({ type, data, ts: Date.now(), url: location.href, sid: sessionId(), vid: visitorId });
    const total = queues.events.length + queues.session.length + queues.heatmaps.length +
                  queues.funnels.length + queues.automations.length;
    if (total >= MAX_BATCH) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  };

  const flush = () => {
    const e = queues.events.splice(0), s = queues.session.splice(0),
          h = queues.heatmaps.splice(0), f = queues.funnels.splice(0),
          a = queues.automations.splice(0);
    if (!e.length && !s.length && !h.length && !f.length && !a.length) return;
    clearTimeout(timer); timer = null;

    // Only include non-empty sections — keeps payload small
    const payload = { website_id: websiteId, domain };
    if (e.length) payload.events      = e;
    if (s.length) payload.session     = s;
    if (h.length) payload.heatmaps    = h;
    if (f.length) payload.funnels     = f;
    if (a.length) payload.automations = a;

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) { navigator.sendBeacon(COLLECT, blob); return; }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', COLLECT, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(payload));
  };

  // ─── Utilities ────────────────────────────────────────────────────────────
  const throttle = (fn, ms) => {
    let last = 0, t = null;
    return function (...a) {
      const now = Date.now(), rem = ms - (now - last);
      if (rem <= 0) { last = now; fn.apply(this, a); }
      else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn.apply(this, a); }, rem); }
    };
  };

  const getSelector = (el) => {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let s = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(s + '#' + el.id); break; }
      if (el.className) s += '.' + [...el.classList].slice(0, 2).join('.');
      parts.unshift(s);
      el = el.parentElement;
    }
    return parts.slice(-3).join('>') || 'body';
  };

  const utmParams = () => {
    const p = new URLSearchParams(location.search), out = {};
    ['source', 'medium', 'campaign', 'term', 'content'].forEach(k => {
      const v = p.get('utm_' + k); if (v) out[k] = v;
    });
    return Object.keys(out).length ? out : null;
  };

  const deviceInfo = () => ({
    ua:   navigator.userAgent,
    lang: navigator.language,
    sw:   screen.width,
    sh:   screen.height,
    vw:   innerWidth,
    vh:   innerHeight,
    dpr:  devicePixelRatio || 1,
    tz:   Intl && Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // ─── Analytics — pageview ─────────────────────────────────────────────────
  const trackPage = () => {
    const utm = utmParams();
    push('pageview', {
      title:    document.title,
      referrer: document.referrer,
      ...deviceInfo(),
      ...(utm && { utm }),
    });
    evalFunnels(location.pathname);
    evalAutomations('pageview', { path: location.pathname, title: document.title });
  };

  // ─── Heatmaps ─────────────────────────────────────────────────────────────
  const initHeatmaps = () => {
    // Clicks — absolute + normalised-to-page coordinates
    document.addEventListener('click', e => {
      const docH = Math.max(document.body.scrollHeight, 1);
      push('heatmap_click', {
        x:      e.clientX,
        y:      e.clientY,
        nx:     +(e.clientX / innerWidth).toFixed(4),              // % viewport width
        ny:     +((e.clientY + scrollY) / docH).toFixed(4),       // % page height
        target: getSelector(e.target),
        text:   (e.target.textContent || '').trim().slice(0, 60),
      });
    }, { passive: true });

    // Scroll depth — fires once per 25/50/75/90/100% milestone
    let maxDepth = 0;
    const MILESTONES = [25, 50, 75, 90, 100];
    window.addEventListener('scroll', throttle(() => {
      const depth = Math.min(100, Math.round(
        (scrollY + innerHeight) / Math.max(document.body.scrollHeight, 1) * 100
      ));
      const hit = MILESTONES.find(m => depth >= m && m > maxDepth);
      if (hit) { maxDepth = hit; push('heatmap_scroll', { depth: hit, path: location.pathname }); }
    }, 300), { passive: true });
  };

  // ─── Session recording ────────────────────────────────────────────────────
  const initRecording = () => {
    const MASK = /password|secret|token|card|cvv|ssn/i;

    const serializeNode = (node) => {
      if (node.nodeType === 3) return { t: 't', v: node.data };
      if (node.nodeType !== 1) return null;
      const attrs = {};
      for (const a of node.attributes) {
        attrs[a.name] = MASK.test(a.name) ? '***' : a.value;
      }
      return {
        t:   'e',
        tag: node.tagName.toLowerCase(),
        a:   attrs,
        c:   [...node.childNodes].map(serializeNode).filter(Boolean),
      };
    };

    // Initial full snapshot
    push('rec_snapshot', { node: serializeNode(document.documentElement) });

    // DOM mutations — streamed as diffs
    new MutationObserver(mutations => {
      const changes = [];
      for (const m of mutations) {
        if (m.type === 'characterData') {
          changes.push({ t: 'text', sel: getSelector(m.target.parentElement), v: m.target.data.slice(0, 500) });
        } else if (m.type === 'attributes') {
          const val = m.target.getAttribute(m.attributeName);
          changes.push({ t: 'attr', sel: getSelector(m.target), k: m.attributeName, v: MASK.test(m.attributeName) ? '***' : val });
        } else {
          changes.push({
            t:   'child',
            sel: getSelector(m.target),
            add: [...m.addedNodes].map(serializeNode).filter(Boolean),
            rem: [...m.removedNodes].map(n => n.nodeType === 1 ? n.tagName.toLowerCase() : null).filter(Boolean),
          });
        }
      }
      if (changes.length) push('rec_mutation', { changes });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

    // Mouse position (50ms throttle — ~20fps max)
    document.addEventListener('mousemove', throttle(e => {
      push('rec_mouse', { x: e.clientX, y: e.clientY, sy: scrollY });
    }, 50), { passive: true });

    // Scroll position
    window.addEventListener('scroll', throttle(() => {
      push('rec_scroll', { x: scrollX, y: scrollY });
    }, 150), { passive: true });

    // Viewport resize
    window.addEventListener('resize', throttle(() => {
      push('rec_resize', { w: innerWidth, h: innerHeight });
    }, 300), { passive: true });

    // Form inputs (passwords & sensitive fields masked)
    document.addEventListener('input', e => {
      const el = e.target;
      const secret = MASK.test(el.type + ' ' + el.name + ' ' + el.id);
      push('rec_input', { sel: getSelector(el), v: secret ? '***' : (el.value || '').slice(0, 200) });
    }, { passive: true });
  };

  // ─── Funnels ──────────────────────────────────────────────────────────────
  const funnelState = {};

  const evalFunnels = (path) => {
    for (const f of funnels) {
      const steps = f.steps || [];
      if (!steps.length) continue;
      const state = funnelState[f.id] || (funnelState[f.id] = { step: 0 });
      const next  = steps[state.step];
      if (!next) continue;
      const hit = next.path
        ? next.path === path
        : next.pattern
          ? new RegExp(next.pattern).test(path)
          : false;
      if (!hit) continue;
      push('funnel_step', { funnel_id: f.id, name: f.name, step: state.step, step_name: next.name, path });
      if (++state.step >= steps.length) {
        push('funnel_complete', { funnel_id: f.id, name: f.name });
        state.step = 0;
      }
    }
  };

  // ─── Automations ──────────────────────────────────────────────────────────
  const evalAutomations = (event, props) => {
    for (const a of automations) {
      const tr = a.trigger;
      if (!tr || tr.event !== event) continue;
      const ok = (tr.conditions || []).every(c => {
        const v = props[c.field];
        if (c.op === 'eq')       return v === c.value;
        if (c.op === 'neq')      return v !== c.value;
        if (c.op === 'contains') return v != null && String(v).includes(c.value);
        if (c.op === 'regex')    return v != null && new RegExp(c.value).test(String(v));
        if (c.op === 'gt')       return +v > +c.value;
        if (c.op === 'lt')       return +v < +c.value;
        return true;
      });
      if (ok) push('automation_trigger', { automation_id: a.id, name: a.name, event, props });
    }
  };

  // ─── Performance timing (PerformanceNavigationTiming API) ────────────────
  const trackPerf = () => {
    const entries = performance && performance.getEntriesByType && performance.getEntriesByType('navigation');
    const t = entries && entries[0];
    if (!t || !t.loadEventEnd) return;
    push('performance', {
      load:    Math.round(t.loadEventEnd),
      dom:     Math.round(t.domContentLoadedEventEnd),
      ttfb:    Math.round(t.responseStart),
      dns:     Math.round(t.domainLookupEnd - t.domainLookupStart),
      connect: Math.round(t.connectEnd - t.connectStart),
      render:  Math.round(t.loadEventEnd - t.responseEnd),
    });
  };

  // ─── SPA routing ──────────────────────────────────────────────────────────
  const initRouting = () => {
    let lastPath = location.pathname;
    const onNav = () => {
      if (location.pathname === lastPath) return;
      lastPath = location.pathname;
      if (autoTrack) trackPage();
      if (cfg.recording !== false) push('rec_navigate', { path: location.pathname });
    };
    window.addEventListener('popstate', onNav);
    ['pushState', 'replaceState'].forEach(m => {
      const orig = history[m];
      if (orig) history[m] = function (...a) { orig.apply(this, a); onNav(); };
    });
  };

  // ─── Initialise ───────────────────────────────────────────────────────────
  const init = () => {
    if (!websiteId) return;
    initRouting();
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);

    fetch(apiHost + '/api/v1/tracker/init/' + websiteId)
      .then(r => r.json())
      .then(d => {
        cfg         = d.config      || {};
        funnels     = d.funnels     || [];
        automations = d.automations || [];
        if (autoTrack)              trackPage();
        if (cfg.heatmaps  !== false) initHeatmaps();
        if (cfg.recording !== false) initRecording();
        window.addEventListener('load', () => setTimeout(trackPerf, 100));
      })
      .catch(() => {
        // Fail-safe: track even if init endpoint is down
        if (autoTrack) trackPage();
        initHeatmaps();
        window.addEventListener('load', () => setTimeout(trackPerf, 100));
      });
  };

  // ─── Public API ───────────────────────────────────────────────────────────
  window.seentics = {
    /** Fire a named custom event */
    track: (name, props) => push('custom', { name, ...(props || {}) }),

    /** Associate current visitor with a known user ID */
    identify: (userId, traits) => {
      const s = store();
      if (s) s.setItem('snc_vid', userId);
      push('identify', { user_id: userId, traits: traits || {} });
    },

    /** Manually fire a pageview (e.g. for custom SPA routing) */
    page: trackPage,

    /** Immediately send any queued events */
    flush,
  };

  document.readyState === 'complete' ? init() : window.addEventListener('load', init);

})(window, document);
