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

/** Longest delay a chain's delay steps may put before an action. */
const MAX_ACTION_DELAY_MS = 300_000;

registerExtension((core) => {
  const fire = (type, data) => { void core.fireAutomationTrigger(type, data); };

  // ─── Actions ───────────────────────────────────────────────────────────────────

  /** Perform one action now. Never throws — a broken action must not break the page. */
  const performClientAction = (action) => {
    try {
      switch (action.type) {
        case 'show_modal':    renderModal(action);   break;
        case 'show_toast':    renderToast(action);   break;
        case 'show_banner':   renderBanner(action);  break;
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

  /** Inject minimal shared styles once. */
  let stylesAdded = false;
  const ensureAutoStyles = () => {
    if (stylesAdded) return;
    stylesAdded = true;
    const s = document.createElement('style');
    s.textContent =
      '.snc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center}' +
      '.snc-modal{background:#fff;color:#111827;border-radius:8px;padding:24px;max-width:480px;width:90%;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:inherit}' +
      // The host page's own `h2 {…}` and `p {…}` rules must not recolour what we show: a site
      // that greys its headings made the modal's title and text hard to read. Colour, font and
      // opacity are taken from the modal itself, which is where the author set them.
      '.snc-modal,.snc-modal *{box-sizing:border-box}' +
      '.snc-modal h2,.snc-modal p,.snc-modal a.snc-modal-btn{font-family:inherit!important;opacity:1!important;text-transform:none!important;letter-spacing:normal!important}' +
      '.snc-modal h2,.snc-modal p{color:inherit!important}' +
      '.snc-modal h2{margin:0 0 12px!important;font-size:20px!important;font-weight:700!important;line-height:1.3!important}' +
      '.snc-modal p{margin:0 0 16px!important;font-size:15px!important;line-height:1.5!important}' +
      '.snc-modal-close{position:absolute;top:10px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;line-height:1;color:inherit;opacity:.7}' +
      '.snc-modal-btn{display:inline-block;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;cursor:pointer;border:none;font-size:14px}' +
      '.snc-toast{position:fixed;z-index:2147483647;padding:12px 20px;border-radius:8px;background:#1a1a1a;color:#fff;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:360px;pointer-events:auto;transition:opacity .3s}' +
      '.snc-toast.top-left{top:20px;left:20px}' +
      '.snc-toast.top-right{top:20px;right:20px}' +
      '.snc-toast.bottom-left{bottom:20px;left:20px}' +
      '.snc-toast.bottom-right{bottom:20px;right:20px}' +
      '.snc-banner{position:fixed;left:0;right:0;z-index:2147483646;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.15)}' +
      '.snc-banner.top{top:0}.snc-banner.bottom{bottom:0}' +
      '.snc-banner-close{background:none;border:none;font-size:18px;cursor:pointer;padding:0;line-height:1;opacity:.7}' +
      '.snc-highlight-pulse{outline:3px solid #f59e0b!important;outline-offset:2px;animation:snc-pulse 1.5s infinite}' +
      '@keyframes snc-pulse{0%,100%{outline-color:#f59e0b}50%{outline-color:#ef4444}}' +
      '.snc-tooltip{position:absolute;background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:6px;font-size:13px;z-index:2147483647;pointer-events:none;max-width:240px;line-height:1.4}' +
      ".snc-tooltip::before{content:'';position:absolute;border:6px solid transparent}";
    document.head.appendChild(s);
  };

  /** Escape a string for safe interpolation into innerHTML (text or attribute position). */
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /** Allow only http(s)/relative URLs in injected href/src — blocks javascript: etc. */
  const safeActionUrl = (u) => {
    const s = String(u ?? '').trim();
    return /^(https?:\/\/|\/)/i.test(s) ? escapeHtml(s) : '#';
  };

  /** Allow only plausible CSS color tokens in injected inline styles. */
  const safeColor = (c, fallback) => {
    const s = String(c ?? '').trim();
    return /^[#a-zA-Z0-9(),.%\s-]{1,40}$/.test(s) && s ? s : fallback;
  };

  /**
   * The author's own markup, style and script for an action.
   *
   * `custom_html` replaces the action's built-in content, `custom_css` is added as a style
   * element inside the action's root (so it is removed with it), and `custom_js` runs once the
   * root is on the page, with `root` and `action` in scope. They are the site owner's own
   * code on the site owner's own page: a script that throws is caught and must never break
   * the page, and a site whose CSP forbids evaluating code simply skips the script.
   */
  const hasCustomHtml = (action) => typeof action.custom_html === 'string' && action.custom_html.trim() !== '';

  const applyCustomCode = (root, action) => {
    if (typeof action.custom_css === 'string' && action.custom_css.trim() !== '') {
      const style = document.createElement('style');
      style.setAttribute('data-snc-custom', '');
      style.textContent = action.custom_css;
      root.appendChild(style);
    }
    if (typeof action.custom_js === 'string' && action.custom_js.trim() !== '') {
      try { new Function('root', 'action', action.custom_js)(root, action); }
      catch (err) { try { console.warn('[seentics] custom_js failed:', err); } catch { /* no console */ } }
    }
  };

  const renderModal = (action) => {
    ensureAutoStyles();
    const overlay = document.createElement('div');
    overlay.className = 'snc-overlay';
    const bgColor   = safeColor(action.background_color, '#ffffff');
    const textColor = safeColor(action.text_color,       '#000000');
    const btnColor  = safeColor(action.button_color,     '#2563eb');
    const btnText   = safeColor(action.button_text_color, '#ffffff');
    const content = hasCustomHtml(action)
      ? `<div class="snc-custom">${action.custom_html}</div>`
      : `${action.image_url ? `<img src="${safeActionUrl(action.image_url)}" style="width:100%;border-radius:4px;margin-bottom:12px" alt="">` : ''}
      ${action.title   ? `<h2>${escapeHtml(action.title)}</h2>` : ''}
      ${action.body    ? `<p>${escapeHtml(action.body)}</p>`    : ''}
      ${action.button_text ? `<a href="${action.button_url ? safeActionUrl(action.button_url) : '#'}" class="snc-modal-btn" style="background:${btnColor};color:${btnText}" ${action.button_url ? '' : 'onclick="return false"'}>${escapeHtml(action.button_text)}</a>` : ''}`;
    overlay.innerHTML = `
    <div class="snc-modal" data-snc="modal" style="background:${bgColor};color:${textColor}">
      <button class="snc-modal-close" aria-label="Close">&times;</button>
      ${content}
    </div>`;
    overlay.querySelector('.snc-modal-close').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    applyCustomCode(overlay, action);
  };

  const renderToast = (action) => {
    ensureAutoStyles();
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

  const renderBanner = (action) => {
    ensureAutoStyles();
    const pos    = action.position ?? 'top';
    const banner = document.createElement('div');
    banner.className = `snc-banner ${pos}`;
    banner.style.background = action.background_color ?? '#1e40af';
    banner.style.color       = action.text_color       ?? '#ffffff';
    banner.setAttribute('data-snc', 'banner');
    banner.innerHTML = hasCustomHtml(action)
      ? `<div class="snc-custom" style="flex:1">${action.custom_html}</div><button class="snc-banner-close" aria-label="Close">&times;</button>`
      : `
    <span>${escapeHtml(action.message ?? '')}</span>
    ${action.button_text ? `<a href="${action.button_url ? safeActionUrl(action.button_url) : '#'}" style="color:inherit;font-weight:600;text-decoration:underline;white-space:nowrap">${escapeHtml(action.button_text)}</a>` : ''}
    <button class="snc-banner-close" aria-label="Close">&times;</button>
  `;
    banner.querySelector('.snc-banner-close').onclick = () => banner.remove();
    document.body.appendChild(banner);
    applyCustomCode(banner, action);
    if (action.duration_ms) setTimeout(() => banner.remove(), action.duration_ms);
  };

  const renderHighlight = (action) => {
    ensureAutoStyles();
    const el = action.selector ? document.querySelector(action.selector) : null;
    if (!el) return;
    el.classList.add('snc-highlight-pulse');
    if (action.scroll_into_view !== false) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.classList.remove('snc-highlight-pulse'), action.duration_ms ?? 4000);
  };

  const renderTooltip = (action) => {
    ensureAutoStyles();
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
