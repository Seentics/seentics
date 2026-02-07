/**
 * Seentics Core Tracker
 * Shared foundation for analytics, automation, and funnel tracking
 * Version: 2.0
 */

(function(w, d) {
  'use strict';

  // Prevent multiple initializations
  if (w.SEENTICS_CORE) return;

  // Core configuration
  const config = {
    apiHost: w.location.hostname === 'localhost' 
      ? 'http://localhost:3002'
      : 'https://api.seentics.com',
    websiteId: null,
    debug: false,
    autoLoad: {
      analytics: true,
      automation: true,
      funnels: true,
      heatmap: true
    }
  };

  // Shared state
  const state = {
    visitorId: null,
    sessionId: null,
    pageViewId: null,
    sessionStart: null,
    lastActivity: Date.now(),
    eventQueue: [],
    isProcessing: false
  };

  // Event emitter for inter-module communication
  const events = {};
  const eventEmitter = {
    on: (event, callback) => {
      if (!events[event]) events[event] = [];
      events[event].push(callback);
    },
    emit: (event, data) => {
      if (events[event]) {
        events[event].forEach(cb => cb(data));
      }
    },
    off: (event, callback) => {
      if (events[event]) {
        events[event] = events[event].filter(cb => cb !== callback);
      }
    }
  };

  // Utility functions
  const utils = {
    generateId: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    getCookie: (name) => {
      const value = `; ${d.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    },

    setCookie: (name, value, days) => {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      d.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
    },

    getSessionCookie: (name) => {
      return sessionStorage.getItem(name);
    },

    setSessionCookie: (name, value) => {
      sessionStorage.setItem(name, value);
    },

    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  // Session management
  const session = {
    init: () => {
      // Visitor ID (persistent)
      state.visitorId = utils.getCookie('seentics_vid');
      if (!state.visitorId) {
        state.visitorId = utils.generateId();
        utils.setCookie('seentics_vid', state.visitorId, 365);
      }

      // Session ID (30 min timeout)
      state.sessionId = utils.getSessionCookie('seentics_sid');
      const lastActivity = utils.getSessionCookie('seentics_last_activity');
      const now = Date.now();

      if (!state.sessionId || !lastActivity || (now - parseInt(lastActivity)) > 1800000) {
        state.sessionId = utils.generateId();
        state.sessionStart = now;
        utils.setSessionCookie('seentics_sid', state.sessionId);
        eventEmitter.emit('session:start', { sessionId: state.sessionId });
      }

      utils.setSessionCookie('seentics_last_activity', now.toString());
      state.lastActivity = now;
    },

    updateActivity: () => {
      const now = Date.now();
      state.lastActivity = now;
      utils.setSessionCookie('seentics_last_activity', now.toString());
    }
  };

  // API communication
  const api = {
    send: async (endpoint, data) => {
      try {
        const response = await fetch(`${config.apiHost}/api/v1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (config.debug) {
          console.error('[Seentics] API error:', error);
        }
        throw error;
      }
    },

    get: async (endpoint, params = {}) => {
      try {
        const url = new URL(`${config.apiHost}/api/v1/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (config.debug) {
          console.error('[Seentics] API error:', error);
        }
        throw error;
      }
    },

    batch: async (events) => {
      return api.send('analytics/batch', {
        siteId: config.websiteId,
        domain: w.location.hostname,
        events
      });
    }
  };

  // Queue management
  const queue = {
    add: (event) => {
      state.eventQueue.push({
        ...event,
        visitor_id: state.visitorId,
        session_id: state.sessionId,
        timestamp: new Date().toISOString()
      });

      if (state.eventQueue.length >= 10) {
        queue.flush();
      }
    },

    flush: utils.debounce(async () => {
      if (state.isProcessing || state.eventQueue.length === 0) return;

      state.isProcessing = true;
      const eventsToSend = [...state.eventQueue];
      state.eventQueue = [];

      try {
        await api.batch(eventsToSend);
        eventEmitter.emit('queue:flushed', { count: eventsToSend.length });
      } catch (error) {
        // Re-add failed events
        state.eventQueue.unshift(...eventsToSend);
        eventEmitter.emit('queue:error', { error });
      } finally {
        state.isProcessing = false;
      }
    }, 1000)
  };

  // Page tracking
  const page = {
    getCurrentPage: () => ({
      url: w.location.href,
      path: w.location.pathname,
      title: d.title,
      referrer: d.referrer,
      screen: {
        width: w.screen.width,
        height: w.screen.height
      },
      viewport: {
        width: w.innerWidth,
        height: w.innerHeight
      }
    })
  };

  // State flags
  const flags = {
    isReady: false
  };

  // Initialize core
  const init = async (options = {}) => {
    Object.assign(config, options);
    
    if (!config.websiteId) {
      console.error('[Seentics] Website ID is required');
      return;
    }

    // Try fetching remote config for module toggles
    try {
      const remoteConfig = await api.get(`tracker/config/${config.websiteId}`);
      if (remoteConfig) {
        config.dynamicConfig = remoteConfig;
        // Update module toggles based on backend settings
        if (remoteConfig.automation_enabled !== undefined) config.autoLoad.automation = !!remoteConfig.automation_enabled;
        if (remoteConfig.funnel_enabled !== undefined) config.autoLoad.funnels = !!remoteConfig.funnel_enabled;
        if (remoteConfig.heatmap_enabled !== undefined) config.autoLoad.heatmap = !!remoteConfig.heatmap_enabled;
        
        if (config.debug) {
          console.log('[Seentics] Config loaded:', config.autoLoad);
        }
      }
    } catch (err) {
      if (config.debug) console.warn('[Seentics] Using default config due to error:', err);
    }

    session.init();

    // Auto-flush queue before page unload
    w.addEventListener('beforeunload', () => {
      if (state.eventQueue.length > 0) {
        queue.flush();
      }
    });

    // Periodic flush
    setInterval(() => {
      if (state.eventQueue.length > 0) {
        queue.flush();
      }
    }, 5000);

    // Activity tracking
    ['click', 'scroll', 'mousemove', 'keydown'].forEach(event => {
      d.addEventListener(event, utils.debounce(session.updateActivity, 1000));
    });

    flags.isReady = true;
    eventEmitter.emit('core:ready', { config, state });
  };

  // Public API
  w.SEENTICS_CORE = {
    version: '2.0',
    init,
    config,
    state,
    utils,
    session,
    api,
    queue,
    page,
    on: eventEmitter.on,
    emit: eventEmitter.emit,
    off: eventEmitter.off,
    isReady: () => flags.isReady
  };

  // Auto-init if data-website-id is present
  const script = d.currentScript;
  if (script) {
    const websiteId = script.getAttribute('data-website-id') || script.getAttribute('data-site-id');
    const debug = script.getAttribute('data-debug') === 'true';
    const apiHost = script.getAttribute('data-api-host');
    const autoLoad = script.getAttribute('data-auto-load');
    
    // Parse auto-load modules
    if (autoLoad) {
      const modules = autoLoad.split(',').map(m => m.trim());
      config.autoLoad = {
        analytics: modules.includes('analytics'),
        automation: modules.includes('automation'),
        funnels: modules.includes('funnels'),
        heatmap: modules.includes('heatmap')
      };
    }
    
    if (websiteId) {
      init({ websiteId, debug, apiHost: apiHost || config.apiHost }).then(() => {
        // Auto-load modules
        const basePath = script.src.substring(0, script.src.lastIndexOf('/') + 1);
        const loadModule = (name) => {
          const moduleScript = d.createElement('script');
          moduleScript.src = `${basePath}seentics-${name}.js`;
          moduleScript.async = true;
          moduleScript.onerror = () => {
            if (config.debug) {
              console.warn(`[Seentics] Failed to load ${name} module`);
            }
          };
          d.head.appendChild(moduleScript);
        };
        
        // Load enabled modules
        if (config.autoLoad.analytics) loadModule('analytics');
        if (config.autoLoad.automation) loadModule('automation');
        if (config.autoLoad.funnels) loadModule('funnels');
        if (config.autoLoad.heatmap) loadModule('heatmap');
      });
    }
  }

})(window, document);

