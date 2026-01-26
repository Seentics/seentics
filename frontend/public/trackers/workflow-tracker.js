/**
 * Seentics Workflow Tracker
 * Version: 2.0.0
 * 
 * Orchestrates automated user engagement (modals, banners, notifications)
 * based on real-time behavior triggers and conditions.
 */

(function (w, d) {
  'use strict';

  const S = w.SEENTICS_CORE;
  if (!S) return;

  const siteId = w.seentics?.siteId;
  const apiHost = (w.location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://api.seentics.com');

  // --- State ---
  let workflows = [];
  let listeners = [];
  let timers = [];
  let isReturning = !!S.storage.get(S.KEYS.RETURNING);

  /**
   * Initialize
   */
  const init = async () => {
    if (!siteId) return;
    if (!isReturning) S.storage.set(S.KEYS.RETURNING, 'true', S.LIMITS.VISITOR_DURATION * 10);

    try {
      const res = await fetch(`${apiHost}/api/v1/workflows/site/${siteId}/active`);
      if (!res.ok) return;

      const data = await res.json();
      workflows = data?.workflows?.filter(w => w.status === 'Active') || [];

      setupTriggers();
    } catch (e) {
      if (w.SEENTICS_DEBUG) console.warn('[Seentics] Workflow fetch failed', e);
    }
  };

  /**
   * Trigger Management
   */
  const setupTriggers = () => {
    // 1. Page View
    check(S.EVENTS.PAGEVIEW);

    // 2. Click monitor
    const clickHandler = (e) => {
      workflows.forEach(wf => {
        wf.nodes?.filter(n => n.data?.type === 'Trigger' && n.data?.title === 'Element Click')
          .forEach(node => {
            if (node.data?.settings?.selector && e.target.matches?.(node.data.settings.selector)) {
              execute(wf, node);
            }
          });
      });
    };
    d.addEventListener('click', clickHandler, { passive: true });
    listeners.push(() => d.removeEventListener('click', clickHandler));

    // 3. Time on site
    workflows.forEach(wf => {
      wf.nodes?.filter(n => n.data?.type === 'Trigger' && n.data?.title === 'Time Spent')
        .forEach(node => {
          const seconds = node.data?.settings?.seconds || 0;
          if (seconds > 0) {
            const t = setTimeout(() => execute(wf, node), seconds * 1000);
            timers.push(t);
          }
        });
    });

    // 4. Exit Intent
    const exitHandler = S.throttle((e) => {
      if (e.clientY < 10) check('Exit Intent');
    }, 100);
    d.addEventListener('mousemove', exitHandler);
    listeners.push(() => d.removeEventListener('mousemove', exitHandler));
  };

  /**
   * Execution Core
   */
  const check = (type, data = {}) => {
    workflows.forEach(wf => {
      wf.nodes?.filter(n => n.data?.type === 'Trigger' && n.data?.title.includes(type))
        .forEach(node => execute(wf, node));
    });
  };

  const execute = async (wf, node) => {
    const runId = S.generateId();
    let current = node;

    while (current) {
      if (current.data?.type === 'Condition') {
        const passed = evaluateCondition(current);
        if (!passed) break;
      }

      if (current.data?.type === 'Action') {
        if (canExecuteAction(wf.id, current)) {
          await runAction(current, wf);
          recordAction(wf.id, current);
        }
      }

      // Move to next node (simple direct follow for now)
      const edge = wf.edges?.find(e => e.source === current.id);
      current = edge ? wf.nodes.find(n => n.id === edge.target) : null;
    }
  };

  /**
   * Conditions & Frequency
   */
  const evaluateCondition = (node) => {
    const s = node.data?.settings || {};
    const title = node.data?.title;

    if (title === 'URL Path') return w.location.pathname.includes(s.url || '');
    if (title === 'New vs Returning') return s.visitorType === (isReturning ? 'returning' : 'new');
    if (title === 'Device Type') {
      const isMobile = /mobile/i.test(navigator.userAgent);
      return s.deviceType === 'Any' || (s.deviceType === 'Mobile' ? isMobile : !isMobile);
    }
    return true;
  };

  const canExecuteAction = (wfId, node) => {
    const freq = node.data?.settings?.frequency || 'once_per_session';
    if (freq === 'every_trigger') return true;

    const key = `${S.KEYS.WF_PREFIX}${wfId}_${node.id}`;
    const historical = S.storage.get(key);

    if (freq === 'once_per_session') {
      return !w.sessionStorage.getItem(key);
    }

    return !historical;
  };

  const recordAction = (wfId, node) => {
    const key = `${S.KEYS.WF_PREFIX}${wfId}_${node.id}`;
    S.storage.set(key, 'true');
    w.sessionStorage.setItem(key, 'true');
  };

  /**
   * Actions
   */
  const runAction = async (node, wf) => {
    const s = node.data?.settings || {};
    const title = node.data?.title;

    if (title === 'Show Modal') createUI('modal', s);
    if (title === 'Show Banner') createUI('banner', s);
    if (title === 'Redirect URL' && s.redirectUrl) w.location.href = s.redirectUrl;

    // Server-side logging
    fetch(`${apiHost}/api/v1/workflows/execution/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: wf.id,
        nodeId: node.id,
        siteId,
        visitorId: S.storage.get(S.KEYS.VISITOR_ID)
      }),
      keepalive: true
    }).catch(() => { });
  };

  const createUI = (type, settings) => {
    const el = d.createElement('div');
    el.className = `seentics-${type}-root`;

    if (settings.customHtml) {
      el.innerHTML = settings.customHtml;
    } else {
      // Basic fallback
      el.textContent = settings.modalContent || settings.bannerContent;
    }

    if (settings.customCss) {
      const style = d.createElement('style');
      style.textContent = settings.customCss;
      d.head.appendChild(style);
    }

    d.body.appendChild(el);

    // Cleanup helper
    const close = () => {
      el.classList.add('seentics-fade-out');
      setTimeout(() => el.remove(), 300);
    };

    el.addEventListener('click', (e) => {
      if (e.target.matches('[data-seentics-close], .close-btn')) close();
    });
  };

  /**
   * Lifecycle
   */
  const cleanup = () => {
    listeners.forEach(fn => fn());
    timers.forEach(t => clearTimeout(t));
    listeners = [];
    timers = [];
  };

  // --- Start ---
  S.onIdle(init);
  w.addEventListener('beforeunload', cleanup);

})(window, document);