/**
 * Seentics Funnel Tracker
 * Handles funnel step tracking and conversion monitoring
 * Requires: seentics-core.js
 */
(function(w, d) {
  'use strict';
  var S = w.SEENTICS_CORE;
  if (!S) { console.error('[Seentics Funnel] Core not loaded.'); return; }

  var funnel = {
    activeFunnels: [], currentFunnels: new Map(),
    initialized: false, buffer: []
  };

  var loadFunnels = function() {
    return S.api.get('funnels/active', { website_id: S.config.websiteId }).then(function(r) {
      funnel.activeFunnels = r.funnels || [];
      // Pre-sort steps once to avoid sorting on every event
      funnel.activeFunnels.forEach(function(f) {
        if (f.steps) {
          f.steps.sort(function(a, b) {
            return (a.order !== undefined ? a.order : (a.step_order || 0)) -
                   (b.order !== undefined ? b.order : (b.step_order || 0));
          });
        }
      });
      S.emit('funnel:loaded', { count: funnel.activeFunnels.length });

      var stored = sessionStorage.getItem('seentics_funnel_progress');
      if (stored) {
        var progress = JSON.parse(stored);
        Object.entries(progress).forEach(function(entry) {
          funnel.currentFunnels.set(entry[0], entry[1]);
        });
      }
    }).catch(function(e) {
      if (S.config.debug) console.error('[Seentics Funnel] Load failed:', e);
    });
  };

  var saveFunnelProgress = function() {
    var p = {};
    funnel.currentFunnels.forEach(function(data, id) { p[id] = data; });
    sessionStorage.setItem('seentics_funnel_progress', JSON.stringify(p));
  };

  var getOrder = function(step) { return step.order !== undefined ? step.order : (step.step_order || 0); };

  var matchesStep = function(step, eventData) {
    var type = (step.stepType || step.step_type || '').toLowerCase();
    var match = step.matchType || step.match_type || 'exact';

    if (type === 'page_view' || type === 'pageview') {
      var cp = w.location.pathname;
      var tp = step.pagePath || step.page_path;
      switch (match) {
        case 'contains': return cp.includes(tp);
        case 'starts_with': case 'startswith': return cp.startsWith(tp);
        case 'regex': try { return new RegExp(tp).test(cp); } catch(e) { return false; }
        default: return cp === tp;
      }
    }
    if (type === 'event') return eventData.eventName === (step.eventType || step.event_type);
    return false;
  };

  var trackFunnelEvent = function(funnelId, data) {
    funnel.buffer.push(Object.assign({
      funnel_id: funnelId, website_id: S.config.websiteId,
      visitor_id: S.state.visitorId, session_id: S.state.sessionId,
      started_at: (funnel.currentFunnels.get(funnelId) || {}).startedAt || new Date().toISOString(),
      timestamp: new Date().toISOString()
    }, data));
  };

  var processFunnelStep = function(eventType, eventData) {
    eventData = eventData || {};
    funnel.activeFunnels.forEach(function(def) {
      var fid = def.id, steps = def.steps || [];
      if (steps.length === 0) return;

      var minOrder = getOrder(steps[0]);
      var maxOrder = getOrder(steps[steps.length - 1]);
      var progress = funnel.currentFunnels.get(fid);

      if (!progress) {
        if (matchesStep(steps[0], eventData)) {
          progress = { currentStep: minOrder, completedSteps: [minOrder], startedAt: new Date().toISOString() };
          funnel.currentFunnels.set(fid, progress);
          saveFunnelProgress();
          trackFunnelEvent(fid, { event_type: 'start', step_name: steps[0].name, current_step: minOrder, completed_steps: [minOrder] });
          S.emit('funnel:started', { funnelId: fid, step: steps[0] });
        }
        return;
      }

      var next = null;
      for (var i = 0; i < steps.length; i++) {
        if (getOrder(steps[i]) > progress.currentStep) { next = steps[i]; break; }
      }

      if (next && matchesStep(next, eventData)) {
        var nextOrder = getOrder(next);
        progress.currentStep = nextOrder;
        progress.completedSteps.push(nextOrder);
        saveFunnelProgress();
        var complete = nextOrder === maxOrder;

        trackFunnelEvent(fid, {
          event_type: complete ? 'conversion' : 'progress',
          step_name: next.name, current_step: nextOrder,
          completed_steps: progress.completedSteps, converted: complete
        });

        if (complete) {
          S.emit('funnel:completed', { funnelId: fid, steps: progress.completedSteps });
          funnel.currentFunnels.delete(fid);
          saveFunnelProgress();
        } else {
          S.emit('funnel:progress', { funnelId: fid, step: next, progress: progress });
        }
      }
    });
  };

  // Buffer flush
  setInterval(function() {
    if (funnel.buffer.length === 0) return;
    var batch = funnel.buffer.slice();
    funnel.buffer = [];
    S.api.send('funnels/batch', { website_id: S.config.websiteId, events: batch }).catch(function() {
      funnel.buffer = batch.concat(funnel.buffer);
    });
  }, 30000);

  var flushBeacon = function() {
    if (funnel.buffer.length === 0) return;
    navigator.sendBeacon(S.config.apiHost + '/api/v1/funnels/batch',
      new Blob([JSON.stringify({ website_id: S.config.websiteId, events: funnel.buffer })], { type: 'application/json' }));
    funnel.buffer = [];
  };

  var setupListeners = function() {
    S.on('analytics:pageview', function(data) { processFunnelStep('pageview', data); });
    S.on('analytics:event', function(data) { processFunnelStep('event', data); });

    w.addEventListener('beforeunload', function() {
      funnel.currentFunnels.forEach(function(progress, fid) {
        var def = funnel.activeFunnels.find(function(f) { return f.id === fid; });
        if (def && progress.currentStep < (def.steps || []).length - 1) {
          trackFunnelEvent(fid, { event_type: 'dropoff', current_step: progress.currentStep, completed_steps: progress.completedSteps });
        }
      });
      flushBeacon();
    });
    d.addEventListener('visibilitychange', function() { if (d.visibilityState === 'hidden') flushBeacon(); });
  };

  var init = function() {
    if (funnel.initialized) return;
    funnel.initialized = true;
    loadFunnels().then(setupListeners);
  };

  if (S.isReady && S.isReady()) init();
  else S.on('core:ready', init);

  w.seentics = w.seentics || {};
  w.seentics.funnel = {
    getProgress: function(id) { return funnel.currentFunnels.get(id); },
    getAllProgress: function() { return Object.fromEntries(funnel.currentFunnels); },
    reset: function(id) {
      if (id) funnel.currentFunnels.delete(id); else funnel.currentFunnels.clear();
      saveFunnelProgress();
    }
  };
})(window, document);
