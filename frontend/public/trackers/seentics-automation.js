/**
 * Seentics Automation Tracker
 * Handles automation triggers and UI actions (modal, banner, notification)
 * Requires: seentics-core.js
 */

(function(w, d) {
  'use strict';

  const S = w.SEENTICS_CORE;
  if (!S) {
    console.error('[Seentics Automation] Core not loaded. Include seentics-core.js first.');
    return;
  }

  // Automation state
  const automation = {
    activeAutomations: [],
    executedAutomations: new Set(),
    sessionExecutions: new Set(),
    initialized: false
  };

  // Fetch active automations
  const loadAutomations = async () => {
    try {
      const response = await S.api.get(`workflows/site/${S.config.websiteId}/active`);
      automation.activeAutomations = response.workflows || [];
      S.emit('automation:loaded', { count: automation.activeAutomations.length });
    } catch (error) {
      if (S.config.debug) {
        console.error('[Seentics Automation] Failed to load automations:', error);
      }
    }
  };

  // Check if automation should execute based on frequency and conditions
  const shouldExecute = (auto, triggerData = {}) => {
    const key = auto.id;
    const triggerConfig = auto.triggerConfig || auto.trigger_config || {};
    const conditions = auto.conditions || [];
    const frequency = triggerConfig.frequency || 'every';

    // 1. Check Frequency
    let frequencyPassed = true;
    switch (frequency) {
      case 'once':
      case 'once_per_visitor':
        frequencyPassed = !automation.executedAutomations.has(key);
        break;
      case 'once_per_session':
        frequencyPassed = !automation.sessionExecutions.has(key);
        break;
      case 'once_per_day':
        const lastExec = localStorage.getItem(`seentics_auto_${key}`);
        if (lastExec) {
          const dayAgo = Date.now() - 86400000;
          frequencyPassed = parseInt(lastExec) < dayAgo;
        }
        break;
    }

    if (!frequencyPassed) return false;

    // 2. Check Advanced Conditions (Device, Language, Scroll, etc.)
    for (const condition of conditions) {
      const { type, operator, value } = condition;
      let actualValue;

      switch (type) {
        case 'device':
          actualValue = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
          break;
        case 'visitor':
          actualValue = S.state.sessionStart === S.state.lastActivity ? 'new' : 'returning';
          break;
        case 'language':
          actualValue = navigator.language.substring(0, 2).toLowerCase();
          break;
        case 'url_param':
          const urlParams = new URLSearchParams(window.location.search);
          actualValue = urlParams.get(condition.param);
          break;
        case 'referrer':
          actualValue = d.referrer;
          break;
      }

      if (!evaluateCondition(actualValue, operator, value)) return false;
    }

    return true;
  };

  const evaluateCondition = (actual, operator, expected) => {
    switch (operator) {
      case 'eq': return actual == expected;
      case 'neq': return actual != expected;
      case 'contains': return String(actual).includes(expected);
      case 'gt': return Number(actual) > Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      default: return true;
    }
  };

  // Mark automation as executed
  const markExecuted = (auto) => {
    const key = auto.id;
    const triggerConfig = auto.triggerConfig || auto.trigger_config || {};
    const frequency = triggerConfig.frequency || 'every';

    automation.sessionExecutions.add(key);

    if (frequency === 'once' || frequency === 'once_per_visitor') {
      automation.executedAutomations.add(key);
      const stored = Array.from(automation.executedAutomations);
      localStorage.setItem('seentics_executed_autos', JSON.stringify(stored));
    }

    if (frequency === 'once_per_day') {
      localStorage.setItem(`seentics_auto_${key}`, Date.now().toString());
    }
  };

  // Execute automation actions
  const executeActions = async (auto, triggerData = {}) => {
    const actions = auto.actions || [];
    for (const action of actions) {
      try {
        await executeAction(action, triggerData);
      } catch (error) {
        if (S.config.debug) console.error('[Seentics Automation] Action failed:', error);
      }
    }

    // Track execution server-side
    S.api.send('automations/track', {
      automation_id: auto.id,
      website_id: S.config.websiteId,
      visitor_id: S.state.visitorId,
      session_id: S.state.sessionId,
      status: 'success',
      trigger_data: triggerData
    });
  };

  // Execute single action
  const executeAction = async (action, data) => {
    const config = action.actionConfig || action.action_config || {};
    const actionType = (action.actionType || action.action_type || '').toLowerCase();

    switch (actionType) {
      case 'modal': showModal(config); break;
      case 'banner': showBanner(config); break;
      case 'notification': showNotification(config); break;
      case 'script': injectScript(config); break;
      case 'redirect': if (config.url) window.location.href = config.url; break;
      case 'hide_element':
        if (config.selector) {
          const el = d.querySelector(config.selector);
          if (el) el.style.display = 'none';
        }
        break;
      case 'webhook':
      case 'email':
        // These are primarily logged or handled by the backend
        break;
    }

    S.emit('automation:action', { type: actionType, config });
  };

  // Trigger evaluation engine
  const evaluateTriggers = (eventType, eventData = {}) => {
    automation.activeAutomations.forEach(auto => {
      const triggerType = (auto.triggerType || auto.trigger_type || '').toLowerCase();
      const triggerConfig = auto.triggerConfig || auto.trigger_config || {};
      
      let isTriggerMatch = false;

      // Handle custom triggers
      if (triggerType === 'time_on_page' && eventType === 'timer') {
         isTriggerMatch = eventData.seconds >= (triggerConfig.seconds || 10);
      } else if (triggerType === 'scroll_depth' && eventType === 'scroll') {
         isTriggerMatch = eventData.depth >= (triggerConfig.depth || 50);
      } else if (triggerType === eventType.toLowerCase().replace('_', '')) {
         isTriggerMatch = true;
      }

      if (isTriggerMatch) {
        // Page path matching
        if (triggerConfig.page && triggerConfig.page !== '*') {
          if (window.location.pathname !== triggerConfig.page) return;
        }
        
        if (shouldExecute(auto, eventData)) {
          if (S.config.debug) console.log('[Seentics Automation] Triggering:', auto.name || auto.id);
          executeActions(auto, eventData);
          markExecuted(auto);
        }
      }
    });
  };

  // Listener Setup
  const setupAutomationListeners = () => {
    S.on('analytics:pageview', (data) => evaluateTriggers('pageview', data));
    S.on('analytics:event', (data) => evaluateTriggers('event', data));
    
    // Exit intent
    d.addEventListener('mouseout', (e) => {
      if (e.clientY < 0) evaluateTriggers('page_exit', { reason: 'exit_intent' });
    });

    // Timer trigger
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed++;
      evaluateTriggers('timer', { seconds: elapsed });
      if (elapsed > 3600) clearInterval(timer);
    }, 1000);

    // Scroll trigger
    let maxScroll = 0;
    w.addEventListener('scroll', S.utils.debounce(() => {
      const scrollHeight = d.documentElement.scrollHeight - w.innerHeight;
      if (scrollHeight <= 0) return;
      const depth = Math.round((w.scrollY / scrollHeight) * 100);
      if (depth > maxScroll) {
        maxScroll = depth;
        evaluateTriggers('scroll', { depth: maxScroll });
      }
    }, 500));
  };


  // UI Actions
  const showModal = (config) => {
    const modal = d.createElement('div');
    modal.className = 'seentics-modal-root';

    const primaryAction = config.primaryAction || 'close';
    const secondaryAction = config.secondaryAction || 'close';

    const html = config.customHtml || `
      <div class="seentics-modal-overlay">
        <div class="seentics-modal-content">
          <button class="seentics-modal-close" data-seentics-close aria-label="Close">&times;</button>
          <div class="seentics-modal-body">
            <h2 class="seentics-modal-title">${config.title || 'Attention'}</h2>
            <div class="seentics-modal-text">${config.content || ''}</div>
            <div class="seentics-modal-actions">
              ${config.secondaryButton ? `<button class="seentics-btn-secondary" data-seentics-action="${secondaryAction}">${config.secondaryButton}</button>` : ''}
              <button class="seentics-btn-primary" data-seentics-action="${primaryAction}">${config.primaryButton || 'Continue'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    modal.innerHTML = html;

    const style = d.createElement('style');
    style.textContent = config.customCss || `
      .seentics-modal-overlay {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; z-index: 2147483647;
        animation: seentics-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .seentics-modal-content {
        background: #ffffff; border-radius: 20px; max-width: 480px; width: 90%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); position: relative;
        overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);
        animation: seentics-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .seentics-modal-close {
        position: absolute; top: 20px; right: 20px; background: #f1f5f9;
        border: none; width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; cursor: pointer; color: #64748b; transition: all 0.2s;
      }
      .seentics-modal-close:hover { background: #e2e8f0; color: #0f172a; }
      .seentics-modal-body { padding: 40px 32px 32px; }
      .seentics-modal-title { 
        margin: 0 0 12px; font-size: 24px; font-weight: 800; color: #0f172a; 
        letter-spacing: -0.025em; line-height: 1.2;
      }
      .seentics-modal-text { 
        margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #475569; 
      }
      .seentics-modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
      .seentics-btn-primary, .seentics-btn-secondary {
        padding: 12px 24px; border-radius: 12px; font-size: 15px; font-weight: 700;
        cursor: pointer; border: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .seentics-btn-primary { background: #4f46e5; color: #ffffff; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); }
      .seentics-btn-primary:hover { background: #4338ca; transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); }
      .seentics-btn-secondary { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
      .seentics-btn-secondary:hover { background: #f1f5f9; color: #0f172a; }
      @keyframes seentics-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes seentics-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;

    d.head.appendChild(style);
    d.body.appendChild(modal);

    const handleAction = (action, url) => {
      if (action === 'redirect' && url) {
        window.location.href = url;
      }
      modal.remove();
      style.remove();
    };

    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-seentics-action]');
      if (btn) {
        const action = btn.getAttribute('data-seentics-action');
        const url = action === 'primary' ? config.primaryUrl : config.secondaryUrl;
        handleAction(action, url);
        return;
      }
      if (e.target.matches('[data-seentics-close]') || e.target.classList.contains('seentics-modal-overlay')) {
        modal.remove();
        style.remove();
      }
    });

    if (config.customJs) {
      try {
        new Function('modal', config.customJs)(modal);
      } catch (e) {
        console.error('[Seentics] Modal JS error:', e);
      }
    }
  };

  const showBanner = (config) => {
    const banner = d.createElement('div');
    banner.className = 'seentics-banner-root';
    const position = config.position || 'bottom';

    const html = config.customHtml || `
      <div class="seentics-banner" style="
        position: fixed; ${position}: 0; left: 0; right: 0;
        background: ${config.backgroundColor || '#0f172a'}; 
        color: ${config.textColor || '#ffffff'};
        padding: 16px 24px; z-index: 2147483646;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
        animation: seentics-slide-${position === 'top' ? 'down' : 'up'} 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="display: flex; align-items: center; gap: 16px; max-width: 1200px; width: 100%; margin: 0 auto; position: relative;">
          <div style="background: rgba(255,255,255,0.15); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
            ${config.icon || '✨'}
          </div>
          <div style="flex: 1; font-size: 15px; font-weight: 600; line-height: 1.4; letter-spacing: 0.01em;">
            ${config.content || ''}
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            ${config.primaryButton ? `
              <button class="seentics-banner-btn" data-seentics-action="redirect" style="
                background: #ffffff; color: #0f172a; padding: 8px 20px; border-radius: 8px; 
                font-size: 13px; font-weight: 700; border: none; cursor: pointer;
                transition: transform 0.2s;
              ">${config.primaryButton}</button>
            ` : ''}
            ${config.closeButton !== false ? `
              <button class="seentics-banner-close" data-seentics-close style="
                background: rgba(255,255,255,0.1); border: none; color: inherit; 
                width: 32px; height: 32px; border-radius: 8px; display: flex; 
                align-items: center; justify-content: center; font-size: 20px; cursor: pointer;
              ">&times;</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    banner.innerHTML = html;
    d.body.appendChild(banner);

    const style = d.createElement('style');
    style.textContent = `
       @keyframes seentics-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
       @keyframes seentics-slide-down { from { transform: translateY(-100%); } to { transform: translateY(0); } }
       .seentics-banner-btn:hover { transform: scale(1.05); }
    `;
    d.head.appendChild(style);

    banner.addEventListener('click', (e) => {
      if (e.target.matches('[data-seentics-close]')) {
        banner.remove();
        style.remove();
      } else if (e.target.closest('[data-seentics-action="redirect"]')) {
        if (config.primaryUrl) window.location.href = config.primaryUrl;
      }
    });

    if (config.duration > 0) {
      setTimeout(() => { banner.remove(); style.remove(); }, config.duration * 1000);
    }
  };

  const showNotification = (config) => {
    const notification = d.createElement('div');
    const type = config.type || 'info';
    const icons = { success: '✓', error: '✕', warning: '!', info: 'ℹ' };
    const colors = { 
      success: { bg: '#ecfdf5', border: '#10b981', text: '#064e3b', icon: '#10b981' },
      error: { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d', icon: '#ef4444' },
      warning: { bg: '#fffbeb', border: '#f59e0b', text: '#78350f', icon: '#f59e0b' },
      info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a', icon: '#3b82f6' }
    };
    const c = colors[type];

    notification.innerHTML = `
      <div class="seentics-notification" style="
        position: fixed; ${config.position || 'top'}: 24px; right: 24px;
        background: ${c.bg}; border: 1px solid ${c.border}40; border-radius: 16px; 
        padding: 16px; min-width: 340px; max-width: 420px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        z-index: 2147483645; display: flex; gap: 16px;
        animation: seentics-slide-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <div style="
          background: ${c.icon}; color: white; width: 32px; height: 32px; 
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: bold; flex-shrink: 0;
        ">
          ${icons[type]}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 15px; font-weight: 700; color: ${c.text}; margin-bottom: 4px;">${config.title || 'Notification'}</div>
          <div style="font-size: 13px; color: ${c.text}99; line-height: 1.5; font-weight: 500;">${config.message || ''}</div>
        </div>
        <button data-seentics-close style="
          background: transparent; border: none; font-size: 20px; cursor: pointer; 
          color: ${c.text}40; padding: 0; line-height: 1; height: fit-content;
          transition: color 0.2s;
        ">&times;</button>
      </div>
    `;

    const style = d.createElement('style');
    style.textContent = \`
      @keyframes seentics-slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .seentics-notification [data-seentics-close]:hover { color: \${c.text} !important; }
    \`;
    d.head.appendChild(style);
    d.body.appendChild(notification);

    notification.addEventListener('click', (e) => {
      if (e.target.matches('[data-seentics-close]')) {
        notification.remove();
        style.remove();
      }
    });

    if (config.duration > 0 || !config.duration) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
          style.remove();
        }
      }, (config.duration || 5) * 1000);
    }
  };

  const injectScript = (config) => {
    const script = d.createElement('script');
    script.textContent = config.code || '';
    (config.position === 'head' ? d.head : d.body).appendChild(script);
  };

  // Initialize
  const init = async () => {
    // Prevent double init
    if (automation.initialized) return;
    automation.initialized = true;

    await loadAutomations();
    setupAutomationListeners();

    // Load previously executed automations
    const stored = JSON.parse(localStorage.getItem('seentics_executed_autos') || '[]');
    stored.forEach(id => automation.executedAutomations.add(id));
  };

  // Listen for core ready or init if already ready
  if (S.isReady && S.isReady()) {
    init();
  } else {
    S.on('core:ready', init);
  }

  // Public API
  w.seentics = w.seentics || {};
  w.seentics.automation = {
    showModal,
    showBanner,
    showNotification,
    trigger: evaluateTriggers
  };

})(window, document);
