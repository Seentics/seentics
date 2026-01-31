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
    sessionExecutions: new Set()
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

  // Check if automation should execute based on frequency
  const shouldExecute = (auto) => {
    const key = auto.id;
    // Handle both camelCase and snake_case
    const triggerConfig = auto.triggerConfig || auto.trigger_config || {};
    const frequency = triggerConfig.frequency || 'every';

    switch (frequency) {
      case 'once':
      case 'once_per_visitor':
        return !automation.executedAutomations.has(key);
      case 'once_per_session':
        return !automation.sessionExecutions.has(key);
      case 'once_per_day':
        const lastExec = localStorage.getItem(`seentics_auto_${key}`);
        if (!lastExec) return true;
        const dayAgo = Date.now() - 86400000;
        return parseInt(lastExec) < dayAgo;
      case 'every':
      case 'always':
      default:
        return true;
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
      const stored = JSON.parse(localStorage.getItem('seentics_executed_autos') || '[]');
      stored.push(key);
      localStorage.setItem('seentics_executed_autos', JSON.stringify(stored));
    }

    if (frequency === 'once_per_day') {
      localStorage.setItem(`seentics_auto_${key}`, Date.now().toString());
    }
  };

  // Execute automation actions
  const executeActions = async (auto, triggerData = {}) => {
    for (const action of auto.actions || []) {
      try {
        await executeAction(action, triggerData);
      } catch (error) {
        if (S.config.debug) {
          console.error('[Seentics Automation] Action execution failed:', error);
        }
      }
    }

    // Track execution
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
    // Handle both camelCase and snake_case
    const config = action.actionConfig || action.action_config || {};
    const actionType = action.actionType || action.action_type;

    switch (actionType) {
      case 'modal':
        showModal(config);
        break;
      case 'banner':
        showBanner(config);
        break;
      case 'notification':
        showNotification(config);
        break;
      case 'script':
        injectScript(config);
        break;
      case 'webhook':
        // Webhooks are handled server-side
        break;
      case 'email':
        // Emails are handled server-side
        break;
    }

    S.emit('automation:action', { type: actionType, config });
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

  // Trigger evaluation
  const evaluateTriggers = (eventType, eventData = {}) => {
    automation.activeAutomations.forEach(auto => {
      // Handle both camelCase and snake_case
      const triggerType = (auto.triggerType || auto.trigger_type || '').toLowerCase();
      const triggerConfig = auto.triggerConfig || auto.trigger_config || {};
      const normalizedEventType = eventType.toLowerCase().replace('_', '');
      
      // Match trigger type (normalize both to handle pageView vs pageview)
      if (triggerType === normalizedEventType || triggerType === eventType) {
        // For page view triggers, check if page matches
        if (triggerType === 'pageview' && triggerConfig.page) {
          const currentPage = window.location.pathname;
          const targetPage = triggerConfig.page;
          
          // Skip if page doesn't match
          if (targetPage !== currentPage && targetPage !== '*') {
            return;
          }
        }
        
        if (shouldExecute(auto)) {
          if (S.config.debug) {
            console.log('[Seentics Automation] Executing automation:', auto.name || auto.id);
          }
          executeActions(auto, eventData);
          markExecuted(auto);
        }
      }
    });
  };

  // Setup automation listeners
  const setupAutomationListeners = () => {
    // Listen to analytics events
    S.on('analytics:pageview', (data) => evaluateTriggers('pageview', data));
    S.on('analytics:event', (data) => evaluateTriggers('event', data));
    
    // Exit intent
    d.addEventListener('mouseout', (e) => {
      if (e.clientY < 0) {
        evaluateTriggers('page_exit', { reason: 'exit_intent' });
      }
    });
  };

  // Initialize
  S.on('core:ready', async () => {
    await loadAutomations();
    setupAutomationListeners();

    // Load previously executed automations
    const stored = JSON.parse(localStorage.getItem('seentics_executed_autos') || '[]');
    stored.forEach(id => automation.executedAutomations.add(id));
  });

  // Public API
  w.seentics = w.seentics || {};
  w.seentics.automation = {
    showModal,
    showBanner,
    showNotification,
    trigger: evaluateTriggers
  };

})(window, document);
