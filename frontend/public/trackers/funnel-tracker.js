/**
 * Seentics Funnel Tracker
 * Version: 2.0.0
 * 
 * Tracks multi-step user conversion funnels with robust sequential logic
 * and cross-tab state consistency.
 */

(function (w, d) {
  'use strict';

  const S = w.SEENTICS_CORE;
  if (!S) return;

  const siteId = w.seentics?.siteId;
  const apiHost = (w.location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://api.seentics.com');
  const API_URL = `${apiHost}/api/v1/funnels/track`;

  // --- State ---
  let funnels = new Map();
  let queue = [];
  let flushTimer = null;
  let currentUrl = w.location.pathname;

  /**
   * Load active funnels from API
   */
  const loadFunnels = async () => {
    if (!siteId) return;
    try {
      const res = await fetch(`${apiHost}/api/v1/funnels/active?website_id=${siteId}`, {
        keepalive: true
      });
      if (!res.ok) return;

      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.funnels || data?.data || []);

      const savedState = JSON.parse(S.storage.get(S.KEYS.FUNNEL_STATE) || '{}');

      list.forEach(f => {
        if (!f.is_active) return;

        const state = savedState[f.id] || {
          currentStep: 0,
          completed: [],
          startedAt: null,
          converted: false
        };

        funnels.set(f.id, { ...f, state });
      });

      checkPage();
    } catch (e) {
      if (w.SEENTICS_DEBUG) console.warn('[Seentics] Funnel load failed', e);
    }
  };

  /**
   * Core Progression Logic
   */
  const checkPage = () => {
    const path = w.location.pathname;

    funnels.forEach((fnl, id) => {
      const { steps, state } = fnl;
      if (!steps || state.converted) return;

      steps.forEach((step, idx) => {
        const stepNum = idx + 1;
        const isMatch = step.type === 'page' && matchPath(path, step.condition?.page);

        if (isMatch) {
          // Rule: Can start from step 1, OR progress to next sequential step
          if (stepNum === 1 || stepNum === state.currentStep + 1) {
            progress(id, stepNum, step);
          }
        }
      });
    });
  };

  const progress = (fid, num, step) => {
    const fnl = funnels.get(fid);
    if (!fnl) return;

    if (num === 1) {
      fnl.state.startedAt = new Date().toISOString();
      fnl.state.completed = [];
    }

    fnl.state.currentStep = num;
    fnl.state.completed.push(num - 1);

    if (num === fnl.steps.length) {
      fnl.state.converted = true;
      S.dispatch('funnel_complete', { funnelId: fid });
    }

    saveState();
    enqueueEvent(fid, fnl.state, step);
  };

  const saveState = S.throttle(() => {
    const data = {};
    funnels.forEach((f, id) => data[id] = f.state);
    S.storage.set(S.KEYS.FUNNEL_STATE, data);
  }, 500);

  /**
   * Event Handling
   */
  const enqueueEvent = (fid, state, step) => {
    const event = {
      funnel_id: fid,
      website_id: siteId,
      visitor_id: S.storage.get(S.KEYS.VISITOR_ID),
      session_id: S.storage.get(S.KEYS.SESSION_ID),
      current_step: state.currentStep,
      completed_steps: state.completed,
      started_at: state.startedAt,
      converted: state.converted,
      event_type: state.converted ? 'conversion' : 'progress',
      step_name: step.name,
      timestamp: new Date().toISOString()
    };

    queue.push(event);
    if (!flushTimer) flushTimer = setTimeout(flush, S.LIMITS.BATCH_DELAY);
  };

  const flush = async () => {
    if (!queue.length) return;
    const events = queue.splice(0);
    flushTimer = null;

    try {
      await Promise.all(events.map(evt =>
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evt),
          keepalive: true
        })
      ));
    } catch (e) {
      queue.unshift(...events);
    }
  };

  /**
   * Helpers
   */
  const matchPath = (path, pattern) => {
    if (!pattern) return false;
    if (path === pattern) return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    }
    return false;
  };

  /**
   * Observers
   */
  const setupObservers = () => {
    d.addEventListener('click', (e) => {
      funnels.forEach((fnl, id) => {
        if (fnl.state.converted) return;
        fnl.steps.forEach((step, idx) => {
          if (step.type === 'event' && e.target.matches?.(step.condition?.event)) {
            if (idx + 1 === fnl.state.currentStep + 1) progress(id, idx + 1, step);
          }
        });
      });
    }, { passive: true });

    w.addEventListener('popstate', () => S.onIdle(checkPage));

    // Listen for custom events from main tracker or other scripts
    d.addEventListener('seentics:custom', (e) => {
      const { name } = e.detail;
      funnels.forEach((fnl, id) => {
        fnl.steps.forEach((step, idx) => {
          if (step.type === 'custom' && step.condition?.custom === name) {
            if (idx + 1 === fnl.state.currentStep + 1) progress(id, idx + 1, step);
          }
        });
      });
    });
  };

  // --- Initialize ---
  S.onIdle(() => {
    loadFunnels();
    setupObservers();
  });

})(window, document);