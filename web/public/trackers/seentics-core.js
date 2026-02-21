/**
 * Seentics Core Tracker v2.0
 * Shared foundation for analytics, automation, and funnel tracking
 */
(function(w, d) {
  'use strict';
  if (w.SEENTICS_CORE) return;

  var config = {
    apiHost: (w.location.hostname === 'localhost' || w.location.hostname === '127.0.0.1' || w.location.hostname.endsWith('.local'))
      ? 'http://localhost:8080'
      : 'https://api.seentics.com',
    websiteId: null,
    debug: false,
    autoLoad: { analytics: true, automation: true, funnels: true, heatmap: true, replay: true }
  };

  var state = {
    visitorId: null, sessionId: null, pageViewId: null, sessionStart: null,
    lastActivity: Date.now(), eventQueue: [], isProcessing: false,
    retryCount: 0, retryDelay: 1000, maxRetryDelay: 60000
  };

  // Event emitter
  var events = {};
  var on = function(e, cb) { (events[e] = events[e] || []).push(cb); };
  var emit = function(e, data) { (events[e] || []).forEach(function(cb) { cb(data); }); };
  var off = function(e, cb) { if (events[e]) events[e] = events[e].filter(function(c) { return c !== cb; }); };

  var dbg = function() {
    if (config.debug) console.log.apply(console, ['[Seentics]'].concat(Array.prototype.slice.call(arguments)));
  };

  // Utilities
  var utils = {
    generateId: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    },
    getCookie: function(name) {
      var v = '; ' + d.cookie, parts = v.split('; ' + name + '=');
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    },
    setCookie: function(name, value, days) {
      d.cookie = name + '=' + value + '; expires=' + new Date(Date.now() + days * 864e5).toUTCString() + '; path=/; SameSite=Lax';
    },
    getSessionCookie: function(name) { return sessionStorage.getItem(name); },
    setSessionCookie: function(name, value) { sessionStorage.setItem(name, value); },
    debounce: function(func, wait) {
      var timeout;
      return function() {
        var args = arguments, ctx = this;
        clearTimeout(timeout);
        timeout = setTimeout(function() { func.apply(ctx, args); }, wait);
      };
    }
  };

  // Session management
  var session = {
    init: function() {
      state.visitorId = utils.getCookie('seentics_vid');
      if (!state.visitorId) {
        state.visitorId = utils.generateId();
        utils.setCookie('seentics_vid', state.visitorId, 365);
      }
      state.sessionId = utils.getSessionCookie('seentics_sid');
      var lastAct = utils.getSessionCookie('seentics_last_activity');
      var now = Date.now();
      if (!state.sessionId || !lastAct || (now - parseInt(lastAct)) > 1800000) {
        state.sessionId = utils.generateId();
        state.sessionStart = now;
        utils.setSessionCookie('seentics_sid', state.sessionId);
        emit('session:start', { sessionId: state.sessionId });
      }
      utils.setSessionCookie('seentics_last_activity', now.toString());
      state.lastActivity = now;
    },
    updateActivity: function() {
      var now = Date.now();
      state.lastActivity = now;
      utils.setSessionCookie('seentics_last_activity', now.toString());
    }
  };

  // API
  var api = {
    send: function(endpoint, data) {
      dbg('POST', endpoint);
      return fetch(config.apiHost + '/api/v1/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function(r) {
        if (!r.ok) throw new Error('API error: ' + r.status);
        return r.json();
      });
    },
    get: function(endpoint, params) {
      var url = new URL(config.apiHost + '/api/v1/' + endpoint);
      if (params) Object.keys(params).forEach(function(k) { url.searchParams.append(k, params[k]); });
      return fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }).then(function(r) {
        if (!r.ok) throw new Error('API error: ' + r.status);
        return r.json();
      });
    },
    batch: function(evts) {
      return api.send('analytics/batch', {
        siteId: config.websiteId,
        domain: w.location.hostname,
        events: evts
      });
    }
  };

  // Queue
  var queue = {
    add: function(event) {
      state.eventQueue.push(Object.assign({
        visitor_id: state.visitorId,
        session_id: state.sessionId,
        timestamp: new Date().toISOString()
      }, event));
      if (state.eventQueue.length >= 10) queue.flush();
    },
    flush: function() {
      if (state.isProcessing || state.eventQueue.length === 0) return Promise.resolve();
      state.isProcessing = true;
      var batch = state.eventQueue.slice();
      state.eventQueue = [];
      return api.batch(batch).then(function() {
        emit('queue:flushed', { count: batch.length });
        state.retryCount = 0;
        state.retryDelay = 1000;
        try { localStorage.removeItem('seentics_failed_events'); } catch(e) {}
      }).catch(function(error) {
        state.eventQueue = batch.concat(state.eventQueue);
        try {
          var p = JSON.parse(localStorage.getItem('seentics_failed_events') || '[]');
          localStorage.setItem('seentics_failed_events', JSON.stringify(p.concat(batch).slice(-100)));
        } catch(e) {}
        state.retryCount++;
        state.retryDelay = Math.min(state.retryDelay * 2, state.maxRetryDelay);
        dbg('Retry #' + state.retryCount + ', next in ' + state.retryDelay + 'ms');
        setTimeout(queue.flush, state.retryDelay);
        emit('queue:error', { error: error, retryCount: state.retryCount });
      }).finally(function() {
        state.isProcessing = false;
      });
    },
    restore: function() {
      try {
        var p = JSON.parse(localStorage.getItem('seentics_failed_events') || '[]');
        if (p.length > 0) {
          state.eventQueue = p.concat(state.eventQueue);
          dbg('Restored', p.length, 'failed events');
        }
      } catch(e) {}
    }
  };

  // Page info
  var page = {
    getCurrentPage: function() {
      return {
        url: w.location.href, path: w.location.pathname,
        title: d.title, referrer: d.referrer,
        screen: { width: w.screen.width, height: w.screen.height },
        viewport: { width: w.innerWidth, height: w.innerHeight }
      };
    }
  };

  var flags = { isReady: false };

  // Shared track() shim
  var track = function(eventName, properties) {
    if (w.seentics && w.seentics.analytics && w.seentics.analytics.track) {
      w.seentics.analytics.track(eventName, properties || {});
    } else {
      queue.add({
        event_type: eventName,
        page_url: w.location.href,
        page: w.location.pathname,
        properties: properties || {}
      });
    }
    emit('analytics:event', { eventName: eventName, properties: properties || {} });
  };

  // Initialize
  var init = function(options) {
    Object.assign(config, options || {});
    if (!config.websiteId) { console.error('[Seentics] Website ID is required'); return Promise.resolve(); }

    return (function() {
      dbg('Loading remote config...');
      return api.get('tracker/config/' + config.websiteId).then(function(response) {
        var rc = response && response.data ? response.data : response;
        if (rc) {
          config.dynamicConfig = rc;
          Object.assign(config, rc);
          if (rc.automation_enabled !== undefined) config.autoLoad.automation = !!rc.automation_enabled;
          if (rc.funnel_enabled !== undefined) config.autoLoad.funnels = !!rc.funnel_enabled;
          if (rc.heatmap_enabled !== undefined) config.autoLoad.heatmap = !!rc.heatmap_enabled;
          if (rc.replay_enabled !== undefined) config.autoLoad.replay = !!rc.replay_enabled;
          dbg('Modules:', config.autoLoad);
        }
      }).catch(function(err) {
        console.warn('[Seentics] Failed to load remote config.', err);
      });
    })().then(function() {
      session.init();
      queue.restore();

      w.addEventListener('beforeunload', function() {
        if (state.eventQueue.length > 0) {
          navigator.sendBeacon(
            config.apiHost + '/api/v1/analytics/batch',
            new Blob([JSON.stringify({ siteId: config.websiteId, domain: w.location.hostname, events: state.eventQueue })], { type: 'application/json' })
          );
          state.eventQueue = [];
        }
      });

      setInterval(function() { if (state.eventQueue.length > 0) queue.flush(); }, 30000);

      d.addEventListener('visibilitychange', function() {
        if (d.visibilityState === 'hidden' && state.eventQueue.length > 0) queue.flush();
      });

      ['click', 'scroll', 'mousemove', 'keydown'].forEach(function(evt) {
        d.addEventListener(evt, utils.debounce(session.updateActivity, 1000), { passive: true });
      });

      flags.isReady = true;
      emit('core:ready', { config: config, state: state });
    });
  };

  // Public API
  w.SEENTICS_CORE = {
    version: '2.0', init: init, config: config, state: state,
    utils: utils, session: session, api: api, queue: queue, page: page,
    track: track, on: on, emit: emit, off: off,
    isReady: function() { return flags.isReady; }
  };

  // Auto-init from script tag
  var script = d.currentScript;
  if (script) {
    var websiteId = script.getAttribute('data-website-id') || script.getAttribute('data-site-id');
    var debug = script.getAttribute('data-debug') === 'true';
    var apiHost = script.getAttribute('data-api-host');
    var autoLoad = script.getAttribute('data-auto-load');

    var detectedHost = null;
    try { detectedHost = new URL(script.src).origin; } catch(e) {}

    if (autoLoad) {
      var modules = autoLoad.split(',').map(function(m) { return m.trim(); });
      config.autoLoad = {
        analytics: modules.includes('analytics'), automation: modules.includes('automation'),
        funnels: modules.includes('funnels'), heatmap: modules.includes('heatmap'),
        replay: modules.includes('replay')
      };
    }

    if (websiteId) {
      init({ websiteId: websiteId, debug: debug, apiHost: apiHost || detectedHost || config.apiHost }).then(function() {
        var basePath = script.src.substring(0, script.src.lastIndexOf('/') + 1);
        var useMin = script.src.includes('.min.js');
        var loadModule = function(name) {
          var s = d.createElement('script');
          s.src = basePath + 'seentics-' + name + (useMin ? '.min.js' : '.js') + '?t=' + Date.now();
          s.async = true;
          s.onerror = function() { dbg('Failed to load', name); };
          d.head.appendChild(s);
        };
        if (config.autoLoad.analytics) loadModule('analytics');
        if (config.autoLoad.automation) loadModule('automation');
        if (config.autoLoad.funnels) loadModule('funnels');
        if (config.autoLoad.heatmap) loadModule('heatmap');
        if (config.autoLoad.replay) loadModule('replay');
      });
    }
  }
})(window, document);
