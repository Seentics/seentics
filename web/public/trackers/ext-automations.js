/*!
 * Seentics tracker — automations extension: trigger listeners and on-page actions.
 *
 * Loaded by the core only on a site that has automations. The core keeps the evaluate
 * call itself (so a page_view automation is not held up by this download); this holds
 * what runs on the page — the listeners that notice a trigger, and the renderers for the
 * actions that come back.
 */
import { runContinuation } from './automation-runtime.js';
import { registerExtension } from './ext-register.js';
import { createPopupRenderer } from './popup-render.js';
import { ensureStyles } from './popup-styles.js';
import { applyCustomCode, hasCustomHtml } from './popup-util.js';

/** Longest delay a chain's delay steps may put before an action. */
const MAX_ACTION_DELAY_MS = 300_000;

registerExtension((core) => {
  const fire = (type, data) => { void core.fireAutomationTrigger(type, data); };

  // ─── Actions ───────────────────────────────────────────────────────────────────

  /** Perform one action now. Never throws — a broken action must not break the page. */
  const performClientAction = (action) => {
    try {
      switch (action.type) {
        case 'show_modal':    popups.renderModal(action);   break;
        case 'show_toast':    renderToast(action);   break;
        case 'show_banner':   popups.renderBanner(action);  break;
        case 'highlight_element': renderHighlight(action); break;
        case 'show_tooltip':  renderTooltip(action); break;
        case 'personalize_content': renderPersonalize(action); break;
        case 'redirect':      renderRedirect(action); break;
        case 'tag_session':
          core.pushAnalytics('custom', { name: 'session_tag', tag: action.tag, automation_id: action.automation_id });
          break;
        case 'continue_when':
          // Not a visible action: the remainder of the graph, for the page to finish once
          // the wait resolves.
          runContinuation(action.continuation, action.delay_ms, executeClientActions, { pageEnterMs: core.pageEnterMs });
          break;
        default: break;
      }
    } catch { /* never crash the page */ }
  };

  /**
   * Run a batch of client actions, honouring the `delay_ms` a chain's delay steps produced.
   *
   * Actions are grouped by offset rather than scheduled individually: a chain of five
   * actions behind one delay costs one timer, not five, and the actions in a group still
   * run in the order the server sent them. Anything at offset zero runs synchronously, so
   * the common case — no delays at all — allocates nothing and schedules nothing.
   */
  const executeClientActions = (actions) => {
    if (!actions || !actions.length) return;

    let deferred = null;

    for (const action of actions) {
      const delay = Math.min(Math.max(0, action.delay_ms | 0), MAX_ACTION_DELAY_MS);
      if (delay === 0) {
        performClientAction(action);
        continue;
      }
      if (!deferred) deferred = new Map();
      const group = deferred.get(delay);
      if (group) group.push(action);
      else deferred.set(delay, [action]);
    }

    if (!deferred) return;
    for (const [delay, group] of deferred) {
      setTimeout(() => {
        for (const action of group) performClientAction(action);
      }, delay);
    }
  };

  /**
   * Modals and bars live in `popup-render.js`, shared with the dashboard's live preview.
   * This extension supplies the one thing that differs: how a submitted form reaches the
   * server, and the `lead_captured` event that follows it.
   */
  const popups = createPopupRenderer({
    root: document.body,
    submit: async (action, payload) => {
      try {
        const res = await fetch(core.apiHost + '/api/v1/tracker/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website_id:    core.websiteId,
            anonymous_id:  core.visitorId,
            session_id:    core.getSessionId(),
            automation_id: action.automation_id,
            variant:       action.variant,
            page_url:      location.href,
            referrer:      document.referrer,
            ...payload,
          }),
        });
        if (!res.ok) return false;
        // A goal or funnel step can be built on this like any other event.
        core.pushAnalytics('custom', { name: 'lead_captured', automation_id: action.automation_id, variant: action.variant });
        // The server's answer carries the prize, if the popup pays one. Nothing else.
        const body = await res.json().catch(() => ({}));
        return { prize: body && body.prize ? body.prize : null };
      } catch { return false; }
    },
  });

  const renderToast = (action) => {
    ensureStyles();
    const pos   = action.position ?? 'bottom-right';
    const toast = document.createElement('div');
    toast.className = `snc-toast ${pos}`;
    toast.style.background = action.background_color ?? '#1a1a1a';
    toast.style.color       = action.text_color       ?? '#ffffff';
    toast.setAttribute('data-snc', 'toast');
    if (hasCustomHtml(action)) toast.innerHTML = action.custom_html;
    else toast.textContent = action.message ?? '';
    document.body.appendChild(toast);
    applyCustomCode(toast, action);
    const dur = (action.duration_ms ?? 4000);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, dur);
  };

  const renderHighlight = (action) => {
    ensureStyles();
    const el = action.selector ? document.querySelector(action.selector) : null;
    if (!el) return;
    el.classList.add('snc-highlight-pulse');
    if (action.scroll_into_view !== false) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.classList.remove('snc-highlight-pulse'), action.duration_ms ?? 4000);
  };

  const renderTooltip = (action) => {
    ensureStyles();
    const anchor = action.selector ? document.querySelector(action.selector) : null;
    if (!anchor) return;
    const tip = document.createElement('div');
    tip.className = 'snc-tooltip';
    tip.setAttribute('data-snc', 'tooltip');
    if (hasCustomHtml(action)) tip.innerHTML = action.custom_html;
    else tip.textContent = action.message ?? '';
    document.body.appendChild(tip);
    applyCustomCode(tip, action);
    const rect = anchor.getBoundingClientRect();
    const top  = rect.top + window.scrollY - tip.offsetHeight - 10;
    tip.style.left = `${rect.left + window.scrollX}px`;
    tip.style.top  = `${top}px`;
    setTimeout(() => tip.remove(), action.duration_ms ?? 5000);
  };

  const renderPersonalize = (action) => {
    const els = action.selector ? document.querySelectorAll(action.selector) : [];
    for (const el of els) {
      if (action.html) el.innerHTML = action.html;
      else if (action.text != null) el.textContent = action.text;
    }
  };

  const renderRedirect = (action) => {
    const url = action.url;
    if (!url) return;
    const delay = action.delay_ms ?? 0;
    const open  = () => {
      if (action.new_tab) window.open(url, '_blank');
      else location.href = url;
    };
    if (delay > 0) setTimeout(open, delay);
    else open();
  };

  // ─── Trigger listeners ─────────────────────────────────────────────────────────

  const triggersOf = (type) => {
    const out = [];
    for (const auto of core.automations) {
      for (const t of (auto && Array.isArray(auto.triggers) ? auto.triggers : [])) {
        if (t && t.type === type) out.push(t);
      }
    }
    return out;
  };

  /**
   * The values this site's automations ask a trigger for — `seconds` for time on page and
   * inactivity — so the tracker fires at exactly those values, which is what the server
   * matches. A trigger with no value configured keeps the defaults.
   */
  const configuredThresholds = (type, key, defaults) => {
    const values = new Set();
    let unconfigured = false;
    for (const t of triggersOf(type)) {
      const v = Number(t[key]);
      if (Number.isFinite(v) && v > 0) values.add(v);
      else unconfigured = true;
    }
    if (unconfigured || !values.size) for (const d of defaults) values.add(d);
    return [...values].sort((a, b) => a - b);
  };

  /**
   * "About to leave", detected once and shared by whatever listens for it.
   *
   * On a desktop that is the cursor leaving through the top of the window. A phone has no
   * cursor, so there the signal is the one most mobile exit popups use: a quick pull back up
   * towards the top of the page, which is how people reach the address bar or the tabs. It is a
   * guess at intent, not a certainty, and it is deliberately not tied to the Back button.
   */
  const exitListeners = [];
  let exitDetectionInstalled = false;
  const onExitSignal = (listener) => {
    exitListeners.push(listener);
    if (exitDetectionInstalled) return;
    exitDetectionInstalled = true;

    const emit = (source) => { for (const l of exitListeners) l(source); };
    document.addEventListener('mouseleave', (ev) => {
      if (ev.clientY > 0) return;
      emit('mouse');
    });

    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse), (hover: none)').matches;
    if (!touch) return;

    const WINDOW_MS = 600;   // how quickly the pull has to happen
    let samples = [];        // recent scroll positions, newest last
    window.addEventListener('scroll', () => {
      const now = Date.now();
      const y = window.scrollY;
      samples.push({ y, t: now });
      samples = samples.filter((p) => now - p.t <= WINDOW_MS);
      const highest = Math.max(...samples.map((p) => p.y));
      const farEnough = highest - y >= Math.max(300, window.innerHeight * 0.4);
      // It has to end near the top: scrolling up the middle of a page is just reading.
      if (farEnough && y <= window.innerHeight * 0.25) {
        samples = [];
        emit('scroll_up');
      }
    }, { passive: true });
  };

  /** Fire when the visitor looks about to leave (30 s cooldown). */
  const installExitIntent = () => {
    let cooldown = false;
    onExitSignal((source) => {
      if (cooldown) return;
      cooldown = true;
      fire('exit_intent', { path: location.pathname, source });
      setTimeout(() => { cooldown = false; }, 30_000);
    });
  };

  /**
   * Funnel drop-off: a visitor part-way through a funnel who stops or goes to leave.
   *
   * The server cannot know a visitor dropped off until the session is long over, and an action
   * has to reach them while they are still here, so drop-off means the two signals available on
   * the page: they have been idle for a while (60 s unless the trigger says otherwise), or they
   * look about to leave. Each is reported once per funnel and step.
   */
  const installFunnelDropoff = () => {
    const configs = triggersOf('funnel').filter((t) => t.event === 'dropoff');
    if (!configs.length || typeof core.funnelsInProgress !== 'function') return;

    const seen = new Set();   // funnel:step:reason, so a stall or exit is reported once per step
    const report = (reason, extra) => {
      for (const progress of core.funnelsInProgress()) {
        const key = `${progress.funnel_id}:${progress.step}:${reason}:${extra.seconds ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fire('funnel', { ...progress, ...extra, event: 'dropoff', reason });
      }
    };

    onExitSignal((source) => report('exit_intent', { source }));

    const thresholds = configuredThresholds('funnel', 'seconds', [60]);
    let lastActivity = Date.now();
    const onActivity = () => { lastActivity = Date.now(); };
    for (const eventName of ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']) {
      window.addEventListener(eventName, onActivity, { passive: true, capture: true });
    }
    setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      for (const seconds of thresholds) {
        if (idleMs >= seconds * 1000) report('inactive', { seconds });
      }
    }, 1_000);
  };

  /**
   * Fire after the configured stretches without input.
   *
   * Activity is noted with a timestamp, not by resetting timers: the reset used to clear
   * and re-arm a timer per threshold on every mousemove and scroll event — hundreds of
   * timer operations a second while the visitor moved the mouse. Now one check runs per
   * second and compares against the last activity.
   */
  const installInactivity = () => {
    const thresholds = configuredThresholds('inactivity', 'seconds', [30]);
    let lastActivity = Date.now();
    let fired = new Set();
    const onActivity = () => { lastActivity = Date.now(); fired = new Set(); };
    for (const eventName of ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']) {
      window.addEventListener(eventName, onActivity, { passive: true, capture: true });
    }
    setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      for (const seconds of thresholds) {
        if (idleMs >= seconds * 1000 && !fired.has(seconds)) {
          fired.add(seconds);
          fire('inactivity', { path: location.pathname, seconds, inactivity_ms: seconds * 1000 });
        }
      }
    }, 1_000);
  };

  /** Fire at 25/50/75/90 % of the page, once each. Throttled to one layout read per 150 ms. */
  const installScrollDepth = () => {
    const milestones = [25, 50, 75, 90];
    const fired = new Set();
    let pending = false;
    const check = () => {
      pending = false;
      const docH = Math.max(document.documentElement.scrollHeight, 1);
      const pct  = Math.round(((window.scrollY + window.innerHeight) / docH) * 100);
      for (const m of milestones) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          fire('scroll_depth', { depth: m, path: location.pathname });
        }
      }
    };
    window.addEventListener('scroll', () => {
      if (pending) return;
      pending = true;
      setTimeout(check, 150);
    }, { passive: true });
  };

  /** Fire at each configured number of seconds since the page view began. */
  const installTimeOnPage = () => {
    const thresholds = configuredThresholds('time_on_page', 'seconds', [15, 30, 60, 120, 300]);
    const fired = new Set();
    const start = core.pageEnterMs;
    // Checked every second: a configured "10 seconds" should fire at 10, not up to 15.
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      for (const t of thresholds) {
        if (elapsed >= t && !fired.has(t)) {
          fired.add(t);
          fire('time_on_page', { seconds: t, path: location.pathname });
        }
      }
      // All thresholds fired — nothing left to observe, stop ticking.
      if (fired.size === thresholds.length) clearInterval(timer);
    }, 1_000);
  };

  /** Three or more clicks within a second, all close together. */
  const installRageClick = () => {
    const WINDOW_MS  = 1_000;
    const RADIUS_PX  = 80;
    const MIN_CLICKS = 3;
    let clicks = [];
    let fired = false;
    document.addEventListener('click', (ev) => {
      const now = Date.now();
      clicks = clicks.filter((c) => now - c.t < WINDOW_MS);
      clicks.push({ x: ev.clientX, y: ev.clientY, t: now });
      if (clicks.length < MIN_CLICKS) return;
      const cx = clicks.reduce((s, c) => s + c.x, 0) / clicks.length;
      const cy = clicks.reduce((s, c) => s + c.y, 0) / clicks.length;
      const inRadius = clicks.every((c) => Math.hypot(c.x - cx, c.y - cy) < RADIUS_PX);
      if (inRadius && !fired) {
        fired = true;
        fire('rage_click', {
          path:   location.pathname,
          count:  clicks.length,
          x:      Math.round(cx),
          y:      Math.round(cy),
          target: (ev.target?.tagName ?? '').toLowerCase(),
        });
        setTimeout(() => { fired = false; clicks = []; }, 5_000);
      }
    });
  };

  /** A form the visitor started and left without submitting, when the tab goes away. */
  const installFormAbandon = () => {
    const touched = new Set();
    document.addEventListener('focusin', (ev) => {
      if (ev.target?.form) touched.add(ev.target.form);
    }, true);
    // Only the submitted form stops being "abandoned" — other touched forms still count.
    document.addEventListener('submit', (ev) => { if (ev.target) touched.delete(ev.target); }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden' || !touched.size) return;
      for (const form of touched) {
        const id = form.id || form.name || form.action || 'unknown';
        fire('form_abandon', { path: location.pathname, form_id: id });
      }
      // Cleared so repeated tab switches don't fire duplicate abandon triggers.
      touched.clear();
    });
  };

  const installTabVisibility = () => {
    document.addEventListener('visibilitychange', () => {
      const type = document.visibilityState === 'hidden' ? 'tab_hidden' : 'tab_visible';
      fire(type, { path: location.pathname });
    });
  };

  /** One delegated listener for every click trigger's selector. */
  const installClickTrigger = () => {
    // Selectors are collected once at install rather than rebuilt on every click.
    const selectors = [...new Set(triggersOf('click').map(t => t.selector).filter(Boolean))];
    if (!selectors.length) return;
    document.addEventListener('click', (ev) => {
      const el = ev.target;
      if (!el) return;
      for (const sel of selectors) {
        try {
          if (el.matches(sel) || el.closest(sel)) {
            fire('click', {
              path:     location.pathname,
              selector: sel,
              text:     (el.textContent ?? '').trim().slice(0, 100),
            });
          }
        } catch { /* invalid selector */ }
      }
    }, { passive: true });
  };

  /**
   * Listeners go in only for trigger types some automation uses. They all used to go in
   * for every visitor on every site — a mousemove handler, a once-a-second timer for five
   * minutes, a click handler — whether or not anything listened for what they detected.
   * (page_view, custom_event, identify and js_error are fired by the core.)
   */
  const installers = {
    exit_intent:  installExitIntent,
    funnel:       installFunnelDropoff,
    inactivity:   installInactivity,
    scroll_depth: installScrollDepth,
    time_on_page: installTimeOnPage,
    rage_click:   installRageClick,
    form_abandon: installFormAbandon,
    tab_hidden:   installTabVisibility,
    tab_visible:  installTabVisibility,
    click:        installClickTrigger,
  };
  const installed = new Set();
  for (const type of core.automationTriggerTypes) {
    const install = installers[type];
    if (!install || installed.has(install)) continue;
    installed.add(install);
    try { install(); } catch { /* a listener that fails to install must not stop the rest */ }
  }

  return { execute: executeClientActions };
});
