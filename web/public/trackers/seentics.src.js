/**
 * Seentics Tracker v4.0 — Unified 2-endpoint analytics, heatmaps, replay, funnels & automation
 * Usage: <script src="/trackers/seentics.js" data-site-id="YOUR_ID"></script>
 */
(function (w, d) {
  'use strict';
  if (w._st) return;
  var loc = w.location, nav = navigator, de = d.documentElement;

  var C = {
    host: '', id: null, debug: false,
    mod: { heatmap: true, replay: true, funnels: true, automation: true }
  };
  var S = { vid: '', sid: '', pvid: '', scroll: 0, t0: Date.now() };
  var _e = {};
  var on = function (n, f) { (_e[n] = _e[n] || []).push(f); };
  var emit = function (n, data) { (_e[n] || []).forEach(function (f) { try { f(data); } catch (x) { } }); };

  // --- Unified data buffers (all flushed via single POST) ---
  var buf = { events: [], heatmaps: [], replay: null, funnels: [], automations: [] };
  var flushing = false;

  // --- Utilities ---
  var uuid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };
  var ck = function (n, v, days) {
    if (v === undefined) { var p = ('; ' + d.cookie).split('; ' + n + '='); return p.length === 2 ? p.pop().split(';').shift() : null; }
    d.cookie = n + '=' + v + '; expires=' + new Date(Date.now() + days * 864e5).toUTCString() + '; path=/; SameSite=Lax';
  };
  var ss = sessionStorage;
  var db = function (fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  };
  var normPath = function (p) { return (!p || p === '/') ? '/' : p.replace(/\/$/, ''); };

  // --- Session ---
  var initSession = function () {
    S.vid = ck('_sv'); if (!S.vid) { S.vid = uuid(); ck('_sv', S.vid, 365); }
    S.sid = ss.getItem('_ss');
    var la = ss.getItem('_sl');
    var s0 = ss.getItem('_ss0');
    var now = Date.now();

    // Check for inactivity (30m) OR total session duration (30m)
    var isInactive = !la || now - parseInt(la) > 1800000;
    var isTooLong = !s0 || now - parseInt(s0) > 1800000;

    if (!S.sid || isInactive || isTooLong) {
      S.sid = uuid();
      ss.setItem('_ss', S.sid);
      ss.setItem('_ss0', now + ''); // Record absolute start of session
      ss.setItem('_rseq', '0');     // Reset replay sequence
    }
    ss.setItem('_sl', now + '');
  };

  // --- API ---
  var post = function (ep, data) {
    return fetch(C.host + '/api/v1/' + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  };
  var get = function (ep) {
    return fetch(C.host + '/api/v1/' + ep).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  };

  // --- Unified flush: single POST /tracker/collect for all data ---
  var buildPayload = function () {
    var p = { site_id: C.id, domain: loc.hostname }, has = false;
    if (buf.events.length) { p.events = buf.events.splice(0); has = true; }
    if (buf.heatmaps.length) { p.heatmaps = buf.heatmaps.splice(0); has = true; }
    if (buf.replay && buf.replay.events.length) {
      p.replay = { session_id: S.sid, events: buf.replay.events.splice(0), sequence: buf.replay.seq++, page: loc.pathname };
      ss.setItem('_rseq', buf.replay.seq + ''); has = true;
    }
    if (buf.funnels.length) { p.funnels = buf.funnels.splice(0); has = true; }
    if (buf.automations.length) { p.automations = buf.automations.splice(0); has = true; }
    return has ? p : null;
  };
  var restoreBuf = function (p) {
    if (p.events) buf.events = p.events.concat(buf.events);
    if (p.heatmaps) buf.heatmaps = p.heatmaps.concat(buf.heatmaps);
    if (p.replay && buf.replay) { buf.replay.events = p.replay.events.concat(buf.replay.events); buf.replay.seq--; }
    if (p.funnels) buf.funnels = p.funnels.concat(buf.funnels);
    if (p.automations) buf.automations = p.automations.concat(buf.automations);
  };
  var flush = function () {
    if (flushing) return;
    var p = buildPayload(); if (!p) return;
    flushing = true;
    post('tracker/collect', p).catch(function () { restoreBuf(p); }).finally(function () { flushing = false; });
  };
  var beaconFlush = function () {
    var p = buildPayload(); if (!p) return;
    nav.sendBeacon(C.host + '/api/v1/tracker/collect', new Blob([JSON.stringify(p)], { type: 'application/json' }));
  };

  // --- Event queue ---
  var enqueue = function (evt) {
    buf.events.push(Object.assign({ visitor_id: S.vid, session_id: S.sid, timestamp: new Date().toISOString() }, evt));
  };

  // ===== ANALYTICS =====
  var pageview = function () {
    S.pvid = uuid(); S.scroll = 0; S.t0 = Date.now();
    enqueue({
      event_type: 'pageview', event_name: 'page_view', page_view_id: S.pvid,
      page_url: loc.href, page: loc.pathname, page_title: d.title, referrer: d.referrer,
      screen_width: w.screen.width, screen_height: w.screen.height,
      viewport_width: w.innerWidth, viewport_height: w.innerHeight,
      user_agent: nav.userAgent, language: nav.language
    });
    emit('pv', { path: loc.pathname });
  };

  var track = function (name, props) {
    enqueue({ event_type: name, page_view_id: S.pvid, page_url: loc.href, page: loc.pathname, properties: props || {} });
    emit('ev', { name: name, props: props || {} });
  };

  w.addEventListener('scroll', db(function () {
    var sh = de.scrollHeight - w.innerHeight; if (sh <= 0) return;
    var depth = Math.round((w.scrollY / sh) * 100);
    if (depth > S.scroll) { S.scroll = depth; if (depth === 50 || depth === 100) track('scroll_depth', { depth: depth }); }
  }, 500), { passive: true });

  d.addEventListener('click', function (e) {
    var t = e.target.closest('a, button, [role="button"], [data-track]');
    if (t) track('click', { tag: t.tagName.toLowerCase(), id: t.id || null, cls: t.className || null, text: (t.textContent || '').substring(0, 100).trim() || null });
  }, true);

  d.addEventListener('submit', function (e) {
    var f = e.target;
    track('form_submission', { form_id: f.id || null, form_action: f.action || null, form_name: f.name || null });
    emit('form', { id: f.id, cls: f.className, action: f.action });
  }, true);

  // SPA navigation via History API
  var _path = loc.pathname;
  var onNav = function () {
    if (loc.pathname !== _path) { _path = loc.pathname; pageview(); emit('nav', { path: _path }); }
  };
  var _push = history.pushState, _rep = history.replaceState;
  history.pushState = function () { _push.apply(this, arguments); onNav(); };
  history.replaceState = function () { _rep.apply(this, arguments); onNav(); };
  w.addEventListener('popstate', onNav);

  var setupGoals = function () {
    (C.goals || []).forEach(function (g) {
      if (g.selector) d.addEventListener('click', function (e) {
        if (e.target.closest(g.selector)) track(g.name, { goal_id: g.id, trigger: 'selector' });
      }, true);
    });
  };

  // ===== HEATMAP =====
  var hm = { rate: 0.1, lastT: 0, lastX: -1, lastY: -1, enabled: true };
  var hmRecordBands = null;

  var hmDims = function () {
    var b = d.body || { scrollHeight: 0, offsetHeight: 0 };
    var r = b.getBoundingClientRect ? b.getBoundingClientRect() : { width: de.clientWidth, left: 0 };
    return {
      w: r.width || de.clientWidth || w.innerWidth,
      l: r.left + (w.pageXOffset || de.scrollLeft),
      h: Math.max(b.scrollHeight || 0, de.scrollHeight, b.offsetHeight || 0, de.offsetHeight, de.clientHeight)
    };
  };
  var hmDev = function () { var ww = w.innerWidth; return ww < 768 ? 'mobile' : ww < 1024 ? 'tablet' : 'desktop'; };
  var hmCoords = function (e) {
    var dims = hmDims(), bw = dims.w || 1, dt = hmDev();
    // For desktop/tablet, normalize to the target rendering width (1200/768)
    // using a centering transform so clicks map correctly to the iframe preview.
    // For mobile, use simple body-width percentage since layouts are full-width.
    var tw = dt === 'mobile' ? bw : dt === 'tablet' ? 768 : 1200;
    var x = ((tw / 2) + (e.pageX - dims.l - bw / 2)) / tw * 1000;
    return {
      x: Math.min(1000, Math.max(0, x)),
      y: Math.min(1000, Math.max(0, (e.pageY / (dims.h || 1)) * 1000))
    };
  };
  var hmSel = function (el) {
    if (!(el instanceof Element)) return '';
    var p = [];
    while (el && el.nodeType === 1) {
      var s = el.nodeName.toLowerCase();
      if (el.id) { p.unshift(s + '#' + el.id); break; }
      var sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) { if (sib.nodeName.toLowerCase() === s) nth++; }
      if (nth !== 1) s += ':nth-of-type(' + nth + ')';
      p.unshift(s); el = el.parentNode;
    }
    return p.join(' > ');
  };
  var hmAdd = function (type, x, y, sel, elX, elY) {
    if (!hm.enabled) return;
    buf.heatmaps.push({ type: type, x: x, y: y, selector: sel || '', el_x: (elX !== undefined ? elX : -1), el_y: (elY !== undefined ? elY : -1), url: normPath(loc.pathname), device_type: hmDev(), timestamp: Math.floor(Date.now() / 1000) });
  };

  var initHeatmap = function () {
    var tracked = C.tracked_urls || [], maxH = C.max_heatmaps || 0, cp = loc.pathname;
    if (maxH > 0 && !tracked.includes(cp) && tracked.length >= maxH) { hm.enabled = false; return; }
    if (!tracked.includes(cp)) tracked.push(cp);

    hmAdd('pageview', 0, 0);

    d.addEventListener('mousemove', function (e) {
      var now = Date.now(); if (now - hm.lastT < 150 || Math.random() > hm.rate) return;
      var c = hmCoords(e);
      if (Math.abs(c.x - hm.lastX) < 1 && Math.abs(c.y - hm.lastY) < 1) return;
      hm.lastT = now; hm.lastX = c.x; hm.lastY = c.y; hmAdd('move', c.x, c.y);
    }, { passive: true });
    // Touch move for mobile heatmap — synthesise a pointer event from the first touch point.
    d.addEventListener('touchmove', function (e) {
      var now = Date.now(); if (now - hm.lastT < 150 || Math.random() > hm.rate) return;
      var t = e.touches[0]; if (!t) return;
      var c = hmCoords({ pageX: t.pageX, pageY: t.pageY });
      if (Math.abs(c.x - hm.lastX) < 1 && Math.abs(c.y - hm.lastY) < 1) return;
      hm.lastT = now; hm.lastX = c.x; hm.lastY = c.y; hmAdd('move', c.x, c.y);
    }, { passive: true });

    // Shared click/tap handler — works for both mouse and touch (touchend gives better coordinates on mobile).
    var hmHandleClick = function (pageX, pageY, clientX, clientY, target) {
      var c = hmCoords({ pageX: pageX, pageY: pageY });
      var sel = hmSel(target);
      var elX = -1, elY = -1;
      if (sel && target instanceof Element) {
        var rect = target.getBoundingClientRect();
        if (rect.width > 0) elX = Math.max(0, Math.min(1000, Math.round((clientX - rect.left) / rect.width * 1000)));
        if (rect.height > 0) elY = Math.max(0, Math.min(1000, Math.round((clientY - rect.top) / rect.height * 1000)));
      }
      hmAdd('click', c.x, c.y, sel, elX, elY);
    };
    d.addEventListener('click', function (e) {
      // Skip synthetic click events that follow a touchend (we handle those via touchend).
      if (e.detail === 0 && e.clientX === 0 && e.clientY === 0) return;
      hmHandleClick(e.pageX, e.pageY, e.clientX, e.clientY, e.target);
    });
    // touchend gives accurate final touch position for tap recording on mobile.
    d.addEventListener('touchend', function (e) {
      var t = e.changedTouches && e.changedTouches[0]; if (!t) return;
      // Only record single-finger taps (not swipes or multi-touch).
      if (e.changedTouches.length !== 1) return;
      var el = d.elementFromPoint(t.clientX, t.clientY) || e.target;
      hmHandleClick(t.pageX, t.pageY, t.clientX, t.clientY, el);
    }, { passive: true });

    var maxBand = 0, sentBands = {};
    hmRecordBands = function () {
      var stop = w.pageYOffset || de.scrollTop, vh = w.innerHeight, dh = hmDims().h || 1;
      var bottom = Math.min(1000, Math.round(((stop + vh) / dh) * 1000));
      if (bottom <= maxBand) return; maxBand = bottom;
      for (var b = 0; b <= bottom; b += 50) { if (!sentBands[b]) { sentBands[b] = true; hmAdd('scroll', 500, b); } }
    };
    w.addEventListener('scroll', function () { hmRecordBands(); }, { passive: true });
    setTimeout(hmRecordBands, 1000);

    w.addEventListener('message', function (ev) {
      if (ev.data === 'SEENTICS_GET_DIMENSIONS') {
        var dims = hmDims();
        ev.source.postMessage({
          type: 'SEENTICS_DIMENSIONS', height: dims.h, width: dims.w,
          left: dims.l - (w.pageXOffset || de.scrollLeft), totalWidth: dims.w, url: loc.href
        }, '*');
      }      // Resolve CSS selectors to page-absolute bounding rects for element-based heatmap positioning
      if (ev.data && ev.data.type === 'SEENTICS_QUERY_ELEMENT_RECTS') {
        var rects = {};
        var selectors = ev.data.selectors || [];
        for (var si = 0; si < selectors.length; si++) {
          try {
            var el = d.querySelector(selectors[si]);
            if (el) {
              var r = el.getBoundingClientRect();
              rects[selectors[si]] = {
                left: r.left + (w.pageXOffset || de.scrollLeft),
                top: r.top + (w.pageYOffset || de.scrollTop),
                width: r.width,
                height: r.height
              };
            }
          } catch (qe) { }
        }
        ev.source.postMessage({ type: 'SEENTICS_ELEMENT_RECTS', rects: rects }, '*');
      }      if (ev.data && ev.data.type === 'SEENTICS_SET_SCROLL') w.scrollTo(ev.data.left || 0, ev.data.top || 0);
    });
    if (w.parent !== w) w.addEventListener('scroll', function () {
      w.parent.postMessage({ type: 'SEENTICS_SCROLL', scrollTop: w.pageYOffset || de.scrollTop, scrollLeft: w.pageXOffset || de.scrollLeft }, '*');
    }, { passive: true });
  };

  // ===== SESSION REPLAY =====
  var initReplay = function () {
    var rate = (typeof C.replay_sampling_rate === 'number' && C.replay_sampling_rate > 0) ? C.replay_sampling_rate : 0.1;
    if (Math.random() > rate) return;

    var basePath = '/trackers/';
    var scr = d.querySelector('script[data-site-id],script[data-website-id]');
    if (scr && scr.src) basePath = scr.src.substring(0, scr.src.lastIndexOf('/') + 1);

    buf.replay = { events: [], seq: parseInt(ss.getItem('_rseq') || '0') };
    var s0 = parseInt(ss.getItem('_ss0') || Date.now() + '');
    var remaining = 1800000 - (Date.now() - s0);

    if (remaining <= 0) return; // Session limit reached

    var loadRR = function () {
      if (w.rrweb) return Promise.resolve();
      return new Promise(function (ok, fail) {
        var s = d.createElement('script'); s.src = basePath + 'rrweb.min.js'; s.async = true; s.onload = ok;
        s.onerror = function () {
          var s2 = d.createElement('script'); s2.src = 'https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.18/dist/rrweb.umd.js';
          s2.async = true; s2.onload = ok; s2.onerror = fail; d.head.appendChild(s2);
        };
        d.head.appendChild(s);
      });
    };

    loadRR().then(function () {
      if (!w.rrweb) return;
      var gotFirstSnapshot = false;
      var stop = w.rrweb.record({
        emit: function (ev) {
          // A new full snapshot (type 2) marks a rrweb checkpoint.
          // Flush any accumulated incremental events into their own chunk
          // so the following chunk starts with a self-contained snapshot,
          // preventing "Node with id not found" warnings during replay.
          if (ev.type === 2 && buf.replay.events.length > 0) {
            flush();
          }
          buf.replay.events.push(ev);
          // Flush chunk 0 immediately after the first full snapshot so the
          // replay data is available right away instead of waiting for the
          // 10 s interval. This prevents "starts late" issues.
          if (ev.type === 2 && !gotFirstSnapshot) {
            gotFirstSnapshot = true;
            flush();
          }
        },
        // Force a fresh full DOM snapshot every 30 s so long recordings
        // stay self-contained and dynamic/SPA nodes are always captured.
        checkoutEveryNms: 30000,
        maskAllInputs: true, maskInputOptions: { password: true, email: true }
      });
      if (!stop) return;
      setTimeout(function () { flush(); stop(); }, remaining);
    }).catch(function () { });
  };

  // ===== FUNNELS =====
  var initFunnels = function () {
    var funnels = C._funnels || [], progress = new Map();
    funnels.forEach(function (f) { if (f.steps) f.steps.sort(function (a, b) { return (a.order || a.step_order || 0) - (b.order || b.step_order || 0); }); });
    var stored = ss.getItem('_fp');
    if (stored) { try { var p = JSON.parse(stored); Object.entries(p).forEach(function (e) { progress.set(e[0], e[1]); }); } catch (x) { } }

    var save = function () { var p = {}; progress.forEach(function (v, k) { p[k] = v; }); ss.setItem('_fp', JSON.stringify(p)); };
    var ord = function (s) { return s.order !== undefined ? s.order : (s.step_order || 0); };
    var match = function (step, data) {
      var type = (step.stepType || step.step_type || '').toLowerCase(), m = step.matchType || step.match_type || 'exact';
      if (type === 'page_view' || type === 'pageview') {
        var tp = step.pagePath || step.page_path, cp = loc.pathname;
        return m === 'contains' ? cp.includes(tp) : m === 'starts_with' ? cp.startsWith(tp) : cp === tp;
      }
      return type === 'event' && data.name === (step.eventType || step.event_type);
    };
    var process = function (data) {
      funnels.forEach(function (def) {
        var fid = def.id, steps = def.steps || []; if (!steps.length) return;
        var pr = progress.get(fid);
        if (!pr) {
          if (match(steps[0], data)) {
            pr = { step: ord(steps[0]), done: [ord(steps[0])], t: new Date().toISOString() };
            progress.set(fid, pr); save();
            buf.funnels.push({ funnel_id: fid, website_id: C.id, visitor_id: S.vid, session_id: S.sid, event_type: 'start', step_name: steps[0].name, current_step: pr.step, timestamp: new Date().toISOString() });
          }
          return;
        }
        var next = null;
        for (var i = 0; i < steps.length; i++) { if (ord(steps[i]) > pr.step) { next = steps[i]; break; } }
        if (next && match(next, data)) {
          var no = ord(next); pr.step = no; pr.done.push(no); save();
          var complete = no === ord(steps[steps.length - 1]);
          buf.funnels.push({ funnel_id: fid, website_id: C.id, visitor_id: S.vid, session_id: S.sid, event_type: complete ? 'conversion' : 'progress', step_name: next.name, current_step: no, converted: complete, timestamp: new Date().toISOString() });
          if (complete) { progress.delete(fid); save(); emit('funnel:done', { fid: fid }); }
        }
      });
    };
    on('pv', function (d) { process(d); });
    on('ev', function (d) { process(d); });
  };

  // ===== AUTOMATION =====
  var initAutomation = function () {
    var autos = C._workflows || [], executed = new Set(), sessExec = new Set();
    try { JSON.parse(localStorage.getItem('_sae') || '[]').forEach(function (id) { executed.add(id); }); } catch (e) { }

    var shouldRun = function (a) {
      var tc = a.triggerConfig || a.trigger_config || {}, freq = tc.frequency || 'every';
      if ((freq === 'once' || freq === 'once_per_visitor') && executed.has(a.id)) return false;
      if (freq === 'once_per_session' && sessExec.has(a.id)) return false;
      if (freq === 'once_per_day') { var l = localStorage.getItem('_sa' + a.id); if (l && parseInt(l) > Date.now() - 864e5) return false; }
      return true;
    };
    var markRan = function (a) {
      var tc = a.triggerConfig || a.trigger_config || {}, freq = tc.frequency || 'every';
      sessExec.add(a.id);
      if (freq === 'once' || freq === 'once_per_visitor') { executed.add(a.id); localStorage.setItem('_sae', JSON.stringify(Array.from(executed))); }
      if (freq === 'once_per_day') localStorage.setItem('_sa' + a.id, Date.now() + '');
    };
    var exec = function (a) {
      (a.actions || []).forEach(function (act) {
        var cfg = act.actionConfig || act.action_config || {}, type = (act.actionType || act.action_type || '').toLowerCase();
        if (type === 'redirect' && cfg.url) setTimeout(function () { if (cfg.newTab) w.open(cfg.url, '_blank'); else loc.href = cfg.url; }, (parseInt(cfg.delay) || 0) * 1000);
        else if ((type === 'hide_element' || type === 'hideelement') && cfg.selector) { var el = d.querySelector(cfg.selector); if (el) el.style.display = 'none'; }
        else if ((type === 'show_element' || type === 'showelement') && cfg.selector) { var el2 = d.querySelector(cfg.selector); if (el2) el2.style.display = cfg.display_type || 'block'; }
        else if (type === 'modal') showModal(cfg);
        else if (type === 'banner') showBanner(cfg);
        else if (type === 'notification') showNotif(cfg);
        else if ((type === 'script' || type === 'javascript') && cfg.code) { var s = d.createElement('script'); s.textContent = cfg.code; d.body.appendChild(s); }
        else if ((type === 'track_event' || type === 'trackevent') && cfg.event_name) track(cfg.event_name, {});
        else if ((type === 'set_cookie' || type === 'setcookie') && (cfg.name || cfg.cookie_name)) ck(cfg.name || cfg.cookie_name, cfg.value !== undefined ? cfg.value : cfg.cookie_value, parseInt(cfg.days || cfg.expiration_days) || 30);
      });
      buf.automations.push({ automationId: a.id, websiteId: C.id, visitorId: S.vid, sessionId: S.sid, status: 'success', executedAt: new Date().toISOString() });
    };

    var evaluate = function (evType, data) {
      autos.forEach(function (a) {
        var tt = (a.triggerType || a.trigger_type || '').toLowerCase(), tc = a.triggerConfig || a.trigger_config || {}, m = false;
        if (tt === 'pageview' && evType === 'pageview') m = true;
        else if (tt === 'customevent' && (evType === 'customevent' || evType === 'event')) m = !tc.event_name || (data || {}).name === tc.event_name;
        else if (tt === 'timeonpage' && evType === 'timer') m = (data || {}).sec >= (tc.seconds || 10);
        else if ((tt === 'scroll' || tt === 'scrolldepth') && evType === 'scroll') m = (data || {}).depth >= (tc.percentage || tc.depth || 50);
        else if (tt === 'exitintent' && evType === 'exit') m = true;
        else if (tt === 'formsubmit' && evType === 'form') m = true;
        else if (tt === 'inactivity' && evType === 'inactivity') m = (data || {}).sec >= (tc.seconds || 30);
        else if (tt === 'funnelcomplete' && evType === 'funnel:done') m = !tc.funnel_id || (data || {}).fid === tc.funnel_id;
        if (!m) return;
        if (tc.url_pattern && tc.url_pattern !== '*') {
          var p = tc.url_pattern, cp = loc.pathname;
          if (p.includes('*')) { if (!new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(cp)) return; }
          else if (cp !== p) return;
        }
        if (shouldRun(a)) { exec(a); markRan(a); }
      });
    };

    on('pv', function (d) { evaluate('pageview', d); });
    on('ev', function (d) { evaluate('event', d); });
    on('form', function (d) { evaluate('form', d); });
    on('funnel:done', function (d) { evaluate('funnel:done', d); });

    // Click trigger: selector-based
    var clickAutos = autos.filter(function (a) { return (a.triggerType || a.trigger_type || '').toLowerCase() === 'click'; });
    if (clickAutos.length) {
      d.addEventListener('click', function (e) {
        clickAutos.forEach(function (a) {
          var tc = a.triggerConfig || a.trigger_config || {};
          if (!tc.selector || !e.target.closest(tc.selector)) return;
          if (tc.url_pattern && tc.url_pattern !== '*') {
            var p = tc.url_pattern, cp = loc.pathname;
            if (p.includes('*')) { if (!new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(cp)) return; }
            else if (cp !== p) return;
          }
          if (shouldRun(a)) { exec(a); markRan(a); }
        });
      }, true);
    }

    d.addEventListener('mouseout', function (e) { if (e.clientY < 0) evaluate('exit', {}); });
    d.addEventListener('submit', function (e) { evaluate('form', { id: e.target.id, cls: e.target.className }); }, true);

    var lastAct = Date.now(), inactT;
    var resetInact = function () { lastAct = Date.now(); clearTimeout(inactT); inactT = setTimeout(function () { evaluate('inactivity', { sec: Math.floor((Date.now() - lastAct) / 1000) }); }, 30000); };
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(function (e) { d.addEventListener(e, db(resetInact, 1000), { passive: true }); });
    resetInact();

    var hasTimer = autos.some(function (a) { return (a.triggerType || a.trigger_type || '').toLowerCase() === 'timeonpage'; });
    if (hasTimer) {
      var maxSec = 0;
      autos.forEach(function (a) { if ((a.triggerType || a.trigger_type || '').toLowerCase() === 'timeonpage') maxSec = Math.max(maxSec, (a.triggerConfig || a.trigger_config || {}).seconds || 10); });
      var elapsed = 0, ti = setInterval(function () { elapsed++; evaluate('timer', { sec: elapsed }); if (elapsed >= maxSec + 5) clearInterval(ti); }, 1000);
    }

    var maxScr = 0;
    w.addEventListener('scroll', db(function () {
      var sh = de.scrollHeight - w.innerHeight; if (sh <= 0) return;
      var depth = Math.round((w.scrollY / sh) * 100);
      if (depth > maxScr) { maxScr = depth; evaluate('scroll', { depth: maxScr }); }
    }, 500), { passive: true });
  };

  // --- Automation UI ---
  var _css = false;
  var injectCSS = function () {
    if (_css) return; _css = true;
    var s = d.createElement('style'); s.id = 'st-css';
    s.textContent = '.st-ov{position:fixed;inset:0;background:rgba(15,23,42,.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:2147483647;animation:stFI .4s ease}.st-md{background:#fff;border-radius:20px;max-width:480px;width:90%;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);position:relative;overflow:hidden;animation:stSU .4s ease}.st-cl{position:absolute;top:20px;right:20px;background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;color:#64748b}.st-bd{padding:40px 32px 32px}.st-tt{margin:0 0 12px;font-size:24px;font-weight:800;color:#0f172a}.st-tx{margin:0 0 32px;font-size:16px;line-height:1.6;color:#475569}.st-ac{display:flex;gap:12px;justify-content:flex-end}.st-bp,.st-bs{padding:12px 24px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;border:none}.st-bp{background:#4f46e5;color:#fff}.st-bs{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}@keyframes stFI{from{opacity:0}to{opacity:1}}@keyframes stSU{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
    d.head.appendChild(s);
  };

  var showModal = function (cfg) {
    injectCSS(); var r = d.createElement('div');
    r.innerHTML = '<div class="st-ov"><div class="st-md"><button class="st-cl" data-close>&times;</button><div class="st-bd"><h2 class="st-tt">' + (cfg.title || '') + '</h2><div class="st-tx">' + (cfg.content || '') + '</div><div class="st-ac">' + (cfg.secondaryButton ? '<button class="st-bs" data-act="s">' + cfg.secondaryButton + '</button>' : '') + '<button class="st-bp" data-act="p">' + (cfg.primaryButton || 'Continue') + '</button></div></div></div></div>';
    d.body.appendChild(r);
    r.addEventListener('click', function (e) {
      if (e.target.matches('[data-close]') || e.target.classList.contains('st-ov')) r.remove();
      var btn = e.target.closest('[data-act]');
      if (btn) { var url = btn.dataset.act === 'p' ? cfg.primaryUrl : cfg.secondaryUrl; if (url) loc.href = url; r.remove(); }
    });
  };

  var showBanner = function (cfg) {
    var pos = cfg.position || 'bottom', r = d.createElement('div');
    r.innerHTML = '<div style="position:fixed;' + pos + ':0;left:0;right:0;background:' + (cfg.backgroundColor || '#0f172a') + ';color:' + (cfg.textColor || '#fff') + ';padding:16px 24px;z-index:2147483646;display:flex;align-items:center;justify-content:center"><div style="display:flex;align-items:center;gap:16px;max-width:1200px;width:100%"><div style="flex:1;font-size:15px;font-weight:600">' + (cfg.content || '') + '</div><div style="display:flex;gap:12px">' + (cfg.primaryButton ? '<button data-act="go" style="background:#fff;color:#0f172a;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:700;border:none;cursor:pointer">' + cfg.primaryButton + '</button>' : '') + '<button data-close style="background:rgba(255,255,255,.1);border:none;color:inherit;width:32px;height:32px;border-radius:8px;font-size:20px;cursor:pointer">&times;</button></div></div></div>';
    d.body.appendChild(r);
    r.addEventListener('click', function (e) {
      if (e.target.matches('[data-close]')) r.remove();
      if (e.target.closest('[data-act="go"]') && cfg.primaryUrl) loc.href = cfg.primaryUrl;
    });
    if (cfg.duration > 0) setTimeout(function () { r.remove(); }, cfg.duration * 1000);
  };

  var showNotif = function (cfg) {
    var colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    var c = colors[cfg.type] || colors.info, r = d.createElement('div');
    r.innerHTML = '<div style="position:fixed;top:24px;right:24px;background:#fff;border-left:4px solid ' + c + ';border-radius:12px;padding:16px;min-width:300px;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,.1);z-index:2147483645;display:flex;gap:12px"><div style="flex:1"><div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px">' + (cfg.title || '') + '</div><div style="font-size:13px;color:#64748b">' + (cfg.message || '') + '</div></div><button data-close style="background:none;border:none;font-size:18px;cursor:pointer;color:#94a3b8">&times;</button></div>';
    d.body.appendChild(r);
    r.addEventListener('click', function (e) { if (e.target.matches('[data-close]')) r.remove(); });
    setTimeout(function () { if (r.parentNode) r.remove(); }, (cfg.duration || 5) * 1000);
  };

  // ===== INIT =====
  var script = d.currentScript;
  if (script) {
    C.id = script.getAttribute('data-site-id') || script.getAttribute('data-website-id');
    C.debug = script.getAttribute('data-debug') === 'true';
    var ah = script.getAttribute('data-api-host');
    try { if (!ah) ah = new URL(script.src).origin; } catch (e) { }
    if (ah) C.host = ah;
    if (!C.host) C.host = (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') ? 'http://localhost:8080' : 'https://api.seentics.com';

    if (C.id) {
      get('tracker/init/' + C.id).then(function (r) {
        var rc = r && r.config ? r.config : r;
        if (rc) {
          Object.assign(C, rc);
          if (rc.heatmap_enabled !== undefined) C.mod.heatmap = !!rc.heatmap_enabled;
          if (rc.replay_enabled !== undefined) C.mod.replay = !!rc.replay_enabled;
          if (rc.funnel_enabled !== undefined) C.mod.funnels = !!rc.funnel_enabled;
          if (rc.automation_enabled !== undefined) C.mod.automation = !!rc.automation_enabled;
        }
        C._funnels = r.funnels || [];
        C._workflows = r.workflows || [];
      }).catch(function () { }).then(function () {
        initSession(); pageview(); setupGoals();
        // Init heatmap before flush so the pageview point is included
        if (C.mod.heatmap) initHeatmap();
        // Flush immediately so pageview, session, heatmap, and any initial data
        // reach the server without waiting for the 10 s interval.
        setTimeout(flush, 0);
        setInterval(flush, 10000);
        // On mobile, visibilitychange to 'hidden' is the only reliable unload signal.
        // Use sendBeacon here (not fetch) because fetch requests are aborted when the
        // page is hidden on mobile browsers.
        d.addEventListener('visibilitychange', function () {
          if (d.visibilityState === 'hidden') {
            track('page_exit', { time_on_page: Math.round((Date.now() - S.t0) / 1000), scroll_depth: S.scroll });
            if (hmRecordBands) hmRecordBands();
            beaconFlush();
          }
        });
        // Include touch events so mobile activity correctly resets the session timeout.
        ['click', 'scroll', 'mousemove', 'keydown', 'touchstart', 'touchend'].forEach(function (e) {
          d.addEventListener(e, db(function () { ss.setItem('_sl', Date.now() + ''); }, 1000), { passive: true });
        });
        // pagehide fires reliably on iOS Safari where beforeunload often does not.
        // Guard with a flag so we don't double-beacon if both fire (desktop).
        var _exited = false;
        var onExit = function () {
          if (_exited) return; _exited = true;
          beaconFlush();
        };
        w.addEventListener('pagehide', onExit);
        w.addEventListener('beforeunload', onExit);
        if (C.mod.replay) initReplay();
        if (C.mod.funnels) initFunnels();
        if (C.mod.automation) initAutomation();
        emit('ready');
      });
    }
  }

  w._st = 1;
  w.seentics = { track: track, on: on, emit: emit };
})(window, document);
