/**
 * Seentics Main Analytics Tracker
 * Version: 2.0.0
 * 
 * Optimized for performance and modularity. Uses Seentics Core for
 * state management and ID generation. Supports SPA and legacy navigation.
 */

(function (w, d) {
  'use strict';

  const S = w.SEENTICS_CORE;
  if (!S) return console.warn('[Seentics] Core utilities not found. Load shared-constants.js first.');

  const script = d.currentScript;
  const siteId = script?.getAttribute('data-site-id') || w.SEENTICS_SITE_ID;
  if (!siteId) return console.warn('[Seentics] data-site-id is missing.');

  const apiHost = script?.getAttribute('data-api-host') ||
    (w.location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://api.seentics.com');
  const API_URL = `${apiHost}/api/v1/analytics/event/batch`;

  // --- State ---
  let vid = null, sid = null;
  let pvs = false; // pageview sent
  let url = w.location.pathname;
  let startTime = performance.now();
  let flushTimer = null;
  const queue = [];

  /**
   * Initialize Session & Visitor
   */
  const refreshIds = () => {
    vid = S.storage.get(S.KEYS.VISITOR_ID);
    if (!vid) {
      vid = S.generateId();
      S.storage.set(S.KEYS.VISITOR_ID, vid, S.LIMITS.VISITOR_DURATION);
    }

    const now = Date.now();
    const lastSeen = parseInt(S.storage.get(S.KEYS.SESSION_LAST) || '0', 10);
    sid = S.storage.get(S.KEYS.SESSION_ID);

    if (!sid || (now - lastSeen > S.LIMITS.SESSION_DURATION)) {
      sid = S.generateId();
      S.storage.set(S.KEYS.SESSION_ID, sid, S.LIMITS.SESSION_DURATION);
      S.dispatch('session_start', { sid });
    }
    S.storage.set(S.KEYS.SESSION_LAST, now.toString(), S.LIMITS.SESSION_DURATION);
  };

  /**
   * Batch Processing Engine
   */
  const enqueue = (event) => {
    queue.push(event);
    if (!flushTimer) {
      flushTimer = setTimeout(flush, S.LIMITS.BATCH_DELAY);
    }
  };

  const flush = async () => {
    if (!queue.length) return;
    const events = queue.splice(0);
    flushTimer = null;

    const payload = JSON.stringify({ siteId, events });

    try {
      if ('sendBeacon' in navigator) {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon(API_URL, blob)) return;
      }

      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      });
    } catch (e) {
      if (w.SEENTICS_DEBUG) console.error('[Seentics] Flush failed', e);
      queue.unshift(...events); // retry on next flush
    }
  };

  /**
   * Event Tracking Logic
   */
  const track = (name, props = {}) => {
    refreshIds();
    const event = {
      website_id: siteId,
      visitor_id: vid,
      session_id: sid,
      event_type: name,
      page: w.location.pathname,
      properties: props,
      timestamp: new Date().toISOString(),
      ...S.getUTM()
    };

    // Enrich with device info lazily
    S.onIdle(() => {
      const ua = navigator.userAgent;
      event.browser = /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Other';
      event.device = /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'Desktop';
      event.os = /win/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : /android/i.test(ua) ? 'Android' : /ios|iphone|ipad/i.test(ua) ? 'iOS' : 'Other';
      event.referrer = d.referrer || null;
    });

    enqueue(event);
  };

  const sendPageview = () => {
    if (pvs || !siteId) return;
    const duration = Math.round((performance.now() - startTime) / 1000);

    track(S.EVENTS.PAGEVIEW, { duration });
    pvs = true;
  };

  /**
   * Navigation & Lifecycle
   */
  const onRoute = () => {
    const newUrl = w.location.pathname;
    if (newUrl === url) return;
    url = newUrl;
    startTime = performance.now();
    pvs = false;
    S.onIdle(sendPageview);
  };

  const setupNav = () => {
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    history.pushState = function () {
      pushState.apply(history, arguments);
      onRoute();
    };

    history.replaceState = function () {
      replaceState.apply(history, arguments);
      onRoute();
    };

    w.addEventListener('popstate', onRoute);
    w.addEventListener('beforeunload', flush);
    d.addEventListener('visibilitychange', () => {
      if (d.visibilityState === 'hidden') flush();
    });
  };

  /**
   * Activity Monitoring (Lazy)
   */
  const monitorActivity = () => {
    const events = ['click', 'scroll', 'keypress', 'touchstart'];
    const handler = S.throttle(() => refreshIds(), 2000);

    events.forEach(e => d.addEventListener(e, handler, { passive: true }));
  };

  /**
   * Initialize
   */
  const start = () => {
    refreshIds();
    S.onIdle(sendPageview);
    setupNav();
    monitorActivity();

    // Auto-load sub-trackers
    S.onIdle(() => {
      const load = (src) => {
        if (d.querySelector(`script[src*="${src}"]`)) return;
        const s = d.createElement('script');
        s.src = src;
        s.async = true;
        d.head.appendChild(s);
      };
      load('/trackers/funnel-tracker.js');
      load('/trackers/workflow-tracker.js');
    });
  };

  // --- Exposed API ---
  w.seentics = {
    siteId,
    track,
    identify: (userId) => S.storage.set('seentics_uid', userId),
    flush
  };

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})(window, document);