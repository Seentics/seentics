/**
 * Seentics Automation Tracker
 * Handles automation triggers and UI actions (modal, banner, notification)
 * Requires: seentics-core.js
 */
(function(w, d) {
  'use strict';
  var S = w.SEENTICS_CORE;
  if (!S) { console.error('[Seentics Automation] Core not loaded.'); return; }

  var automation = {
    activeAutomations: [], executedAutomations: new Set(),
    sessionExecutions: new Set(), initialized: false, buffer: []
  };

  var MOBILE_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  var loadAutomations = function() {
    return S.api.get('workflows/site/' + S.config.websiteId + '/active').then(function(r) {
      automation.activeAutomations = r.workflows || [];
      S.emit('automation:loaded', { count: automation.activeAutomations.length });
    }).catch(function(e) {
      if (S.config.debug) console.error('[Seentics Automation] Load failed:', e);
    });
  };

  var evaluateCondition = function(actual, op, expected) {
    switch (op) {
      case 'eq': return actual == expected;
      case 'neq': return actual != expected;
      case 'contains': return String(actual).includes(expected);
      case 'gt': return Number(actual) > Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      default: return true;
    }
  };

  var shouldExecute = function(auto) {
    var key = auto.id;
    var tc = auto.triggerConfig || auto.trigger_config || {};
    var conditions = auto.conditions || [];
    var freq = tc.frequency || 'every';

    // Frequency check
    if (freq === 'once' || freq === 'once_per_visitor') {
      if (automation.executedAutomations.has(key)) return false;
    } else if (freq === 'once_per_session') {
      if (automation.sessionExecutions.has(key)) return false;
    } else if (freq === 'once_per_day') {
      var last = localStorage.getItem('seentics_auto_' + key);
      if (last && parseInt(last) > Date.now() - 86400000) return false;
    }

    // Conditions check
    for (var i = 0; i < conditions.length; i++) {
      var c = conditions[i];
      var type = (c.conditionType || c.type || '').toLowerCase();
      var cfg = c.conditionConfig || c.config || {};
      var op = c.operator || cfg.operator || 'eq';
      var expected = c.value || cfg.value;
      var actual;

      switch (type) {
        case 'device':
          actual = MOBILE_RE.test(navigator.userAgent) ? 'mobile' : 'desktop';
          if (!expected) expected = cfg.device_type;
          break;
        case 'visitor':
          actual = S.state.sessionStart === S.state.lastActivity ? 'new' : 'returning';
          if (!expected) expected = cfg.visitor_status;
          break;
        case 'language':
          actual = navigator.language.substring(0, 2).toLowerCase();
          break;
        case 'url_param':
          actual = new URLSearchParams(w.location.search).get(c.param || cfg.param || cfg.param_name);
          break;
        case 'referrer':
          actual = d.referrer;
          break;
        case 'page_views':
          actual = S.state.pageViews || 1;
          break;
        case 'traffic_source':
          var ref = d.referrer.toLowerCase();
          if (!ref) actual = 'direct';
          else if (ref.includes('google') || ref.includes('bing')) actual = 'organic';
          else if (ref.includes('facebook') || ref.includes('twitter') || ref.includes('linkedin')) actual = 'social';
          else {
            var params = new URLSearchParams(w.location.search);
            actual = (params.get('utm_medium') === 'cpc' || params.get('gclid')) ? 'paid' : 'referral';
          }
          break;
        case 'cookie':
          var cookieName = c.cookie_name || cfg.cookie_name;
          actual = S.utils.getCookie(cookieName);
          if (op === 'exists') return actual !== null;
          if (op === 'not_exists') return actual === null;
          break;
      }
      if (!evaluateCondition(actual, op, expected)) return false;
    }
    return true;
  };

  var markExecuted = function(auto) {
    var key = auto.id;
    var tc = auto.triggerConfig || auto.trigger_config || {};
    var freq = tc.frequency || 'every';
    automation.sessionExecutions.add(key);
    if (freq === 'once' || freq === 'once_per_visitor') {
      automation.executedAutomations.add(key);
      localStorage.setItem('seentics_executed_autos', JSON.stringify(Array.from(automation.executedAutomations)));
    }
    if (freq === 'once_per_day') localStorage.setItem('seentics_auto_' + key, Date.now().toString());
  };

  // Variable replacement
  var replaceVariables = function(text, data) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\{\{([^}]+)\}\}/g, function(match, key) {
      var k = key.trim();
      var all = Object.assign({
        user_id: S.state.userId || S.state.visitorId || 'anonymous',
        user_email: S.state.userEmail || '', user_name: S.state.userName || '',
        user_language: navigator.language || '',
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        session_id: S.state.sessionId || '', page_views: S.state.pageViews || 1,
        referrer: d.referrer || '', page_url: w.location.href,
        page_title: d.title, page_path: w.location.pathname,
        device_type: MOBILE_RE.test(navigator.userAgent) ? 'mobile' : 'desktop',
        screen_width: w.screen.width, screen_height: w.screen.height,
        timestamp: Math.floor(Date.now() / 1000),
        date: new Date().toISOString().split('T')[0]
      }, data || {});
      return all[k] !== undefined ? all[k] : match;
    });
  };

  var processConfig = function(cfg, data) {
    var out = {};
    for (var k in cfg) {
      out[k] = typeof cfg[k] === 'string' ? replaceVariables(cfg[k], data) : cfg[k];
    }
    return out;
  };

  // Execute automation actions
  var executeActions = function(auto, triggerData) {
    var actions = auto.actions || [];
    S.track('automation_triggered', {
      automation_id: auto.id, automation_name: auto.name,
      trigger_type: auto.triggerType || auto.trigger_type, action_count: actions.length
    });

    var ok = 0, fail = 0;
    var chain = Promise.resolve();
    actions.forEach(function(action) {
      chain = chain.then(function() {
        return executeAction(action, triggerData || {}).then(function() { ok++; }).catch(function(err) {
          fail++;
          console.error('[Seentics Automation] Action failed:', err);
          S.track('automation_action_failed', {
            automation_id: auto.id, action_type: action.actionType || action.action_type,
            error: err.message || 'Unknown'
          });
        });
      });
    });

    chain.then(function() {
      S.track('automation_completed', {
        automation_id: auto.id, automation_name: auto.name,
        status: fail === 0 ? 'success' : 'partial_failure',
        success_count: ok, failure_count: fail, total_actions: actions.length
      });
      automation.buffer.push({
        automationId: auto.id, websiteId: S.config.websiteId,
        visitorId: S.state.visitorId, sessionId: S.state.sessionId,
        status: 'success', executionData: triggerData || {},
        executedAt: new Date().toISOString()
      });
    });
  };

  var executeAction = function(action, data) {
    var cfg = processConfig(action.actionConfig || action.action_config || {}, data);
    var type = (action.actionType || action.action_type || '').toLowerCase();

    switch (type) {
      case 'modal': showModal(cfg); break;
      case 'banner': showBanner(cfg); break;
      case 'notification': showNotification(cfg); break;
      case 'script':
        var s = d.createElement('script');
        s.textContent = cfg.code || '';
        (cfg.position === 'head' ? d.head : d.body).appendChild(s);
        break;
      case 'redirect':
        if (cfg.url) {
          setTimeout(function() {
            if (cfg.newTab) w.open(cfg.url, '_blank'); else w.location.href = cfg.url;
          }, (parseInt(cfg.delay) || 0) * 1000);
        }
        break;
      case 'hide_element': case 'hideelement':
        if (cfg.selector) { var el = d.querySelector(cfg.selector); if (el) el.style.display = 'none'; }
        break;
      case 'show_element': case 'showelement':
        if (cfg.selector) { var el2 = d.querySelector(cfg.selector); if (el2) el2.style.display = cfg.display_type || 'block'; }
        break;
      case 'track_event': case 'trackevent':
        if (cfg.event_name) {
          var props = cfg.properties ? JSON.parse(cfg.properties) : {};
          S.emit('analytics:event', { event: cfg.event_name, properties: props });
        }
        break;
      case 'set_cookie': case 'setcookie':
        if (cfg.cookie_name && cfg.cookie_value) {
          S.utils.setCookie(cfg.cookie_name, cfg.cookie_value, parseInt(cfg.expiration_days) || 30);
        }
        break;
    }
    S.emit('automation:action', { type: type, config: cfg });
    return Promise.resolve();
  };

  // Trigger evaluation
  var evaluateTriggers = function(eventType, eventData) {
    eventData = eventData || {};
    automation.activeAutomations.forEach(function(auto) {
      var tt = (auto.triggerType || auto.trigger_type || '').toLowerCase();
      var tc = auto.triggerConfig || auto.trigger_config || {};
      var match = false;

      if (tt === 'timeonpage' && eventType === 'timer') match = eventData.seconds >= (tc.seconds || 10);
      else if (tt === 'scrolldepth' && eventType === 'scroll') match = eventData.depth >= (tc.percentage || tc.depth || 50);
      else if (tt === 'exitintent' && eventType === 'page_exit') match = true;
      else if (tt === 'formsubmit' && eventType === 'formsubmit') {
        if (tc.selector) {
          var form = d.querySelector(tc.selector);
          match = form && (form.id === eventData.formId || form.className.includes(eventData.formClass));
        } else match = true;
      }
      else if (tt === 'inactivity' && eventType === 'inactivity') match = eventData.seconds >= (tc.seconds || 30);
      else if (tt === 'funneldropoff' && eventType === 'funneldropoff') {
        match = !tc.funnel_id || (eventData.funnel_id === tc.funnel_id && (!tc.step || eventData.step === tc.step));
      }
      else if (tt === 'funnelcomplete' && eventType === 'funnelcomplete') {
        match = !tc.funnel_id || eventData.funnel_id === tc.funnel_id;
      }
      else if (tt === 'goalcompleted' && eventType === 'goalcompleted') {
        match = !tc.goal_id || (eventData.goal_id === tc.goal_id && (!tc.min_value || (eventData.value || 0) >= parseFloat(tc.min_value)));
      }
      else if (tt === eventType.toLowerCase().replace('_', '')) match = true;

      if (!match) return;

      // URL pattern matching
      if (tc.url_pattern && tc.url_pattern !== '*') {
        var p = tc.url_pattern, cp = w.location.pathname;
        if (p.includes('*')) { if (!new RegExp('^' + p.replace(/\*/g, '.*') + '$').test(cp)) return; }
        else if (cp !== p) return;
      }

      if (shouldExecute(auto)) {
        if (S.config.debug) console.log('[Seentics Automation] Triggering:', auto.name || auto.id);
        executeActions(auto, eventData);
        markExecuted(auto);
      }
    });
  };

  // Buffer flush
  var flushBuffer = function() {
    if (automation.buffer.length === 0) return;
    var payload = JSON.stringify({ website_id: S.config.websiteId, executions: automation.buffer });
    automation.buffer = [];
    navigator.sendBeacon(S.config.apiHost + '/api/v1/workflows/execution/batch',
      new Blob([payload], { type: 'application/json' }));
  };

  setInterval(function() {
    if (automation.buffer.length === 0) return;
    var batch = automation.buffer.slice();
    automation.buffer = [];
    S.api.send('workflows/execution/batch', { website_id: S.config.websiteId, executions: batch }).catch(function() {
      automation.buffer = batch.concat(automation.buffer);
    });
  }, 30000);

  w.addEventListener('beforeunload', flushBuffer);
  d.addEventListener('visibilitychange', function() { if (d.visibilityState === 'hidden') flushBuffer(); });

  // Listeners
  var setupListeners = function() {
    S.on('analytics:pageview', function(data) { evaluateTriggers('pageview', data); });
    S.on('analytics:event', function(data) { evaluateTriggers('event', data); });
    S.on('funnel:dropoff', function(data) { evaluateTriggers('funneldropoff', data); });
    S.on('funnel:complete', function(data) { evaluateTriggers('funnelcomplete', data); });
    S.on('goal:completed', function(data) { evaluateTriggers('goalcompleted', data); });

    // Exit intent
    d.addEventListener('mouseout', function(e) {
      if (e.clientY < 0) evaluateTriggers('page_exit', { reason: 'exit_intent' });
    });

    // Form submit
    d.addEventListener('submit', function(e) {
      var f = e.target;
      evaluateTriggers('formsubmit', { formId: f.id, formClass: f.className, formAction: f.action });
    }, true);

    // Inactivity
    var inactTimer = null, lastAct = Date.now();
    var resetInact = function() {
      lastAct = Date.now();
      if (inactTimer) clearTimeout(inactTimer);
      inactTimer = setTimeout(function() {
        evaluateTriggers('inactivity', { seconds: Math.floor((Date.now() - lastAct) / 1000) });
      }, 30000);
    };
    ['mousedown','mousemove','keypress','scroll','touchstart'].forEach(function(e) {
      d.addEventListener(e, S.utils.debounce(resetInact, 1000), { passive: true });
    });
    resetInact();

    // Timer — only runs if any automation uses timeonpage trigger
    var hasTimerTrigger = automation.activeAutomations.some(function(a) {
      return (a.triggerType || a.trigger_type || '').toLowerCase() === 'timeonpage';
    });
    if (hasTimerTrigger) {
      var maxSeconds = 0;
      automation.activeAutomations.forEach(function(a) {
        if ((a.triggerType || a.trigger_type || '').toLowerCase() === 'timeonpage') {
          var tc = a.triggerConfig || a.trigger_config || {};
          maxSeconds = Math.max(maxSeconds, tc.seconds || 10);
        }
      });
      var elapsed = 0;
      var timer = setInterval(function() {
        elapsed++;
        evaluateTriggers('timer', { seconds: elapsed });
        if (elapsed >= maxSeconds + 5) clearInterval(timer);
      }, 1000);
    }

    // Scroll
    var maxScroll = 0;
    w.addEventListener('scroll', S.utils.debounce(function() {
      var sh = d.documentElement.scrollHeight - w.innerHeight;
      if (sh <= 0) return;
      var depth = Math.round((w.scrollY / sh) * 100);
      if (depth > maxScroll) { maxScroll = depth; evaluateTriggers('scroll', { depth: maxScroll }); }
    }, 500), { passive: true });
  };

  // UI Components — compact CSS
  var MODAL_CSS = '.seentics-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:2147483647;animation:stFadeIn .4s cubic-bezier(.16,1,.3,1)}.seentics-modal-content{background:#fff;border-radius:20px;max-width:480px;width:90%;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);position:relative;overflow:hidden;animation:stSlideUp .4s cubic-bezier(.16,1,.3,1)}.seentics-modal-close{position:absolute;top:20px;right:20px;background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;color:#64748b;transition:all .2s}.seentics-modal-close:hover{background:#e2e8f0;color:#0f172a}.seentics-modal-body{padding:40px 32px 32px}.seentics-modal-title{margin:0 0 12px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-.025em;line-height:1.2}.seentics-modal-text{margin:0 0 32px;font-size:16px;line-height:1.6;color:#475569}.seentics-modal-actions{display:flex;gap:12px;justify-content:flex-end}.seentics-btn-primary,.seentics-btn-secondary{padding:12px 24px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;border:none;transition:all .2s cubic-bezier(.4,0,.2,1)}.seentics-btn-primary{background:#4f46e5;color:#fff;box-shadow:0 4px 6px -1px rgba(79,70,229,.2)}.seentics-btn-primary:hover{background:#4338ca;transform:translateY(-1px);box-shadow:0 10px 15px -3px rgba(79,70,229,.3)}.seentics-btn-secondary{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}.seentics-btn-secondary:hover{background:#f1f5f9;color:#0f172a}@keyframes stFadeIn{from{opacity:0}to{opacity:1}}@keyframes stSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes stSlideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}@keyframes stSlideUpBanner{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes stSlideRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';

  var injectStyles = function() {
    if (d.getElementById('seentics-auto-css')) return;
    var s = d.createElement('style');
    s.id = 'seentics-auto-css';
    s.textContent = MODAL_CSS;
    d.head.appendChild(s);
  };

  var showModal = function(cfg) {
    injectStyles();
    var root = d.createElement('div');
    root.className = 'seentics-modal-root';
    var pa = cfg.primaryAction || (cfg.primaryUrl ? 'primary' : 'close');
    var sa = cfg.secondaryAction || (cfg.secondaryUrl ? 'secondary' : 'close');

    root.innerHTML = cfg.customHtml || '<div class="seentics-modal-overlay"><div class="seentics-modal-content"><button class="seentics-modal-close" data-seentics-close aria-label="Close">&times;</button><div class="seentics-modal-body"><h2 class="seentics-modal-title">' + (cfg.title || 'Attention') + '</h2><div class="seentics-modal-text">' + (cfg.content || '') + '</div><div class="seentics-modal-actions">' + (cfg.secondaryButton ? '<button class="seentics-btn-secondary" data-seentics-action="' + sa + '">' + cfg.secondaryButton + '</button>' : '') + '<button class="seentics-btn-primary" data-seentics-action="' + pa + '">' + (cfg.primaryButton || 'Continue') + '</button></div></div></div></div>';

    d.body.appendChild(root);
    root.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-seentics-action]');
      if (btn) {
        var act = btn.getAttribute('data-seentics-action');
        var url = act === 'primary' ? cfg.primaryUrl : cfg.secondaryUrl;
        if ((act === 'redirect' || act === 'primary' || act === 'secondary') && url) w.location.href = url;
        root.remove();
      }
      if (e.target.matches('[data-seentics-close]') || e.target.classList.contains('seentics-modal-overlay')) root.remove();
    });
    if (cfg.customJs) { try { new Function('modal', cfg.customJs)(root); } catch(e) {} }
  };

  var showBanner = function(cfg) {
    injectStyles();
    var pos = cfg.position || 'bottom';
    var root = d.createElement('div');
    root.className = 'seentics-banner-root';
    root.innerHTML = cfg.customHtml || '<div style="position:fixed;' + pos + ':0;left:0;right:0;background:' + (cfg.backgroundColor || '#0f172a') + ';color:' + (cfg.textColor || '#fff') + ';padding:16px 24px;z-index:2147483646;box-shadow:0 -4px 20px rgba(0,0,0,.1);animation:stSlide' + (pos === 'top' ? 'Down' : 'UpBanner') + ' .5s cubic-bezier(.16,1,.3,1);display:flex;align-items:center;justify-content:center"><div style="display:flex;align-items:center;gap:16px;max-width:1200px;width:100%;margin:0 auto"><div style="background:rgba(255,255,255,.15);width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">' + (cfg.icon || '&#10024;') + '</div><div style="flex:1;font-size:15px;font-weight:600;line-height:1.4">' + (cfg.content || '') + '</div><div style="display:flex;gap:12px;align-items:center">' + (cfg.primaryButton ? '<button data-seentics-action="redirect" style="background:#fff;color:#0f172a;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:700;border:none;cursor:pointer">' + cfg.primaryButton + '</button>' : '') + (cfg.closeButton !== false ? '<button data-seentics-close style="background:rgba(255,255,255,.1);border:none;color:inherit;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer">&times;</button>' : '') + '</div></div></div>';

    d.body.appendChild(root);
    root.addEventListener('click', function(e) {
      if (e.target.matches('[data-seentics-close]')) root.remove();
      else if (e.target.closest('[data-seentics-action="redirect"]') && cfg.primaryUrl) w.location.href = cfg.primaryUrl;
    });
    if (cfg.duration > 0) setTimeout(function() { root.remove(); }, cfg.duration * 1000);
  };

  var showNotification = function(cfg) {
    injectStyles();
    var type = cfg.type || 'info';
    var icons = { success: '&#10003;', error: '&#10005;', warning: '!', info: '&#8505;' };
    var colors = {
      success: { bg:'#ecfdf5', border:'#10b981', text:'#064e3b', icon:'#10b981' },
      error: { bg:'#fef2f2', border:'#ef4444', text:'#7f1d1d', icon:'#ef4444' },
      warning: { bg:'#fffbeb', border:'#f59e0b', text:'#78350f', icon:'#f59e0b' },
      info: { bg:'#eff6ff', border:'#3b82f6', text:'#1e3a8a', icon:'#3b82f6' }
    };
    var c = colors[type] || colors.info;
    var root = d.createElement('div');
    root.innerHTML = '<div style="position:fixed;' + (cfg.position || 'top') + ':24px;right:24px;background:' + c.bg + ';border:1px solid ' + c.border + '40;border-radius:16px;padding:16px;min-width:340px;max-width:420px;box-shadow:0 20px 25px -5px rgba(0,0,0,.1);z-index:2147483645;display:flex;gap:16px;animation:stSlideRight .5s cubic-bezier(.16,1,.3,1)"><div style="background:' + c.icon + ';color:#fff;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">' + (icons[type] || icons.info) + '</div><div style="flex:1"><div style="font-size:15px;font-weight:700;color:' + c.text + ';margin-bottom:4px">' + (cfg.title || 'Notification') + '</div><div style="font-size:13px;color:' + c.text + '99;line-height:1.5;font-weight:500">' + (cfg.message || '') + '</div></div><button data-seentics-close style="background:transparent;border:none;font-size:20px;cursor:pointer;color:' + c.text + '40;padding:0;line-height:1;height:fit-content">&times;</button></div>';

    d.body.appendChild(root);
    root.addEventListener('click', function(e) {
      if (e.target.matches('[data-seentics-close]')) root.remove();
    });
    setTimeout(function() { if (root.parentNode) root.remove(); }, (cfg.duration || 5) * 1000);
  };

  // Init
  var init = function() {
    if (automation.initialized) return;
    automation.initialized = true;
    loadAutomations().then(function() {
      setupListeners();
      var stored = JSON.parse(localStorage.getItem('seentics_executed_autos') || '[]');
      stored.forEach(function(id) { automation.executedAutomations.add(id); });
    });
  };

  if (S.isReady && S.isReady()) init();
  else S.on('core:ready', init);

  w.seentics = w.seentics || {};
  w.seentics.automation = {
    showModal: showModal, showBanner: showBanner,
    showNotification: showNotification, trigger: evaluateTriggers
  };
})(window, document);
