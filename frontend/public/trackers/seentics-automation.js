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

    const html = config.customHtml || `
      <div class="seentics-modal-overlay">
        <div class="seentics-modal-content">
          <button class="seentics-modal-close" data-seentics-close>&times;</button>
          <div class="seentics-modal-body">
            <h2>${config.title || 'Modal'}</h2>
            <p>${config.content || ''}</p>
            <div class="seentics-modal-actions">
              <button class="seentics-btn-primary" data-seentics-close>${config.primaryButton || 'OK'}</button>
              ${config.secondaryButton ? `<button class="seentics-btn-secondary" data-seentics-close>${config.secondaryButton}</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    modal.innerHTML = html;

    const style = d.createElement('style');
    style.textContent = config.customCss || `
      .seentics-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center; z-index: 999999;
        animation: seentics-fade-in 0.3s ease-out;
      }
      .seentics-modal-content {
        background: white; border-radius: 16px; max-width: 500px; width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); position: relative;
        animation: seentics-scale-in 0.3s ease-out;
      }
      .seentics-modal-close {
        position: absolute; top: 16px; right: 16px; background: transparent;
        border: none; font-size: 32px; cursor: pointer; color: #666;
      }
      .seentics-modal-body { padding: 48px 32px 32px; }
      .seentics-modal-body h2 { margin: 0 0 16px; font-size: 24px; font-weight: 700; }
      .seentics-modal-body p { margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #666; }
      .seentics-modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
      .seentics-btn-primary, .seentics-btn-secondary {
        padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
        cursor: pointer; border: none; transition: all 0.2s;
      }
      .seentics-btn-primary { background: #4F46E5; color: white; }
      .seentics-btn-secondary { background: #f0f0f0; color: #666; }
      @keyframes seentics-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes seentics-scale-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;

    d.head.appendChild(style);
    d.body.appendChild(modal);

    if (config.customJs) {
      try {
        new Function('modal', config.customJs)(modal);
      } catch (e) {
        console.error('[Seentics] Modal JS error:', e);
      }
    }

    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-seentics-close]') || e.target.classList.contains('seentics-modal-overlay')) {
        modal.remove();
        style.remove();
      }
    });
  };

  const showBanner = (config) => {
    const banner = d.createElement('div');
    banner.className = 'seentics-banner-root';

    const html = config.customHtml || `
      <div class="seentics-banner" style="
        position: fixed; ${config.position || 'bottom'}: 0; left: 0; right: 0;
        background: ${config.backgroundColor || '#000'}; color: ${config.textColor || '#fff'};
        padding: 16px 48px 16px 20px; z-index: 999998;
        animation: seentics-slide-${config.position === 'top' ? 'down' : 'up'} 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 12px; max-width: 1200px; margin: 0 auto;">
          <span style="font-size: 20px;">${config.icon || '📢'}</span>
          <span style="flex: 1; font-size: 15px; font-weight: 500;">${config.content || ''}</span>
        </div>
        ${config.closeButton !== false ? '<button class="seentics-banner-close" data-seentics-close style="position: absolute; top: 50%; right: 16px; transform: translateY(-50%); background: transparent; border: none; color: inherit; font-size: 28px; cursor: pointer;">&times;</button>' : ''}
      </div>
    `;

    banner.innerHTML = html;
    d.body.appendChild(banner);

    if (config.closeButton !== false) {
      banner.addEventListener('click', (e) => {
        if (e.target.matches('[data-seentics-close]')) {
          banner.remove();
        }
      });
    }

    if (config.duration > 0) {
      setTimeout(() => banner.remove(), config.duration * 1000);
    }
  };

  const showNotification = (config) => {
    const notification = d.createElement('div');
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const colors = { success: '#10B981', error: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };

    notification.innerHTML = `
      <div style="
        position: fixed; ${config.position || 'top'}: 20px; right: 20px;
        background: white; border-radius: 12px; padding: 16px; min-width: 320px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15); z-index: 999997;
        border-left: 4px solid ${colors[config.type] || colors.info};
        animation: seentics-slide-in-right 0.3s ease-out;
      ">
        <div style="display: flex; gap: 12px;">
          <div style="font-size: 24px;">${icons[config.type] || icons.info}</div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${config.title || 'Notification'}</div>
            <div style="font-size: 13px; color: #666; line-height: 1.4;">${config.message || ''}</div>
          </div>
          <button data-seentics-close style="background: transparent; border: none; font-size: 20px; cursor: pointer; color: #999;">&times;</button>
        </div>
      </div>
    `;

    const style = d.createElement('style');
    style.textContent = '@keyframes seentics-slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    d.head.appendChild(style);
    d.body.appendChild(notification);

    notification.addEventListener('click', (e) => {
      if (e.target.matches('[data-seentics-close]')) {
        notification.remove();
        style.remove();
      }
    });

    if (config.duration > 0) {
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, config.duration * 1000);
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
