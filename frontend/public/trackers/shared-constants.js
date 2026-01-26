/**
 * Seentics Core Utilities & Shared Constants
 * Version: 2.0.0
 * 
 * This module provides centralized storage management, ID generation,
 * and high-performance utilities used by all Seentics trackers.
 */

(function (w) {
  'use strict';

  // --- Constants ---
  const STORAGE_KEYS = {
    VISITOR_ID: 'seentics_vid',
    SESSION_ID: 'seentics_sid',
    SESSION_LAST: 'seentics_last',
    RETURNING: 'seentics_ret',
    FUNNEL_STATE: 'seentics_fnl',
    WF_PREFIX: 'seentics_wf_'
  };

  const LIMITS = {
    SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    VISITOR_DURATION: 365 * 24 * 60 * 60 * 1000, // 1 year
    BATCH_DELAY: 250,
    MAX_RETRY: 3,
    RETRY_BASE: 1000
  };

  const EVENT_TYPES = {
    PAGEVIEW: 'pv',
    CUSTOM: 'ce',
    FUNNEL: 'fn',
    WORKFLOW: 'wf',
    SESSION_START: 'ss',
    SESSION_END: 'se'
  };

  // --- Core Utilities ---
  const Utils = {
    /**
     * Generate a cryptographically strong unique ID
     */
    generateId: () => {
      const array = new Uint32Array(4);
      w.crypto.getRandomValues(array);
      return Array.from(array, dec => dec.toString(36)).join('').slice(0, 32);
    },

    /**
     * Parse current UTM parameters
     */
    getUTM: () => {
      const params = new URLSearchParams(w.location.search);
      const utm = {};
      ['source', 'medium', 'campaign', 'term', 'content'].forEach(key => {
        const val = params.get(`utm_${key}`);
        if (val) utm[`utm_${key}`] = val;
      });
      return utm;
    },

    /**
     * Safe storage operations with auto-resilience
     */
    storage: {
      get: (key) => {
        try {
          const val = localStorage.getItem(key);
          if (!val) return null;
          try {
            const entry = JSON.parse(val);
            if (entry.expiry && Date.now() > entry.expiry) {
              localStorage.removeItem(key);
              return null;
            }
            return entry.value;
          } catch {
            return val;
          }
        } catch (e) { return null; }
      },
      set: (key, value, duration = null) => {
        try {
          const entry = { value, timestamp: Date.now() };
          if (duration) entry.expiry = Date.now() + duration;
          localStorage.setItem(key, JSON.stringify(entry));
          return true;
        } catch (e) { return false; }
      },
      remove: (key) => {
        try {
          localStorage.removeItem(key);
          return true;
        } catch (e) { return false; }
      }
    },

    /**
     * Performance-optimized throttler
     */
    throttle: (fn, delay) => {
      let last = 0;
      let timeout = null;
      return (...args) => {
        const now = Date.now();
        if (now - last >= delay) {
          last = now;
          fn.apply(null, args);
        } else {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            last = Date.now();
            fn.apply(null, args);
          }, delay);
        }
      };
    },

    /**
     * Schedule tasks during idle time
     */
    onIdle: (fn) => {
      if ('requestIdleCallback' in w) {
        w.requestIdleCallback(fn, { timeout: 1000 });
      } else {
        setTimeout(fn, 1);
      }
    },

    /**
     * Unified event dispatcher for cross-tracker communication
     */
    dispatch: (name, detail = {}) => {
      try {
        const event = new CustomEvent(`seentics:${name}`, {
          detail: { ...detail, timestamp: Date.now() },
          bubbles: true,
          cancelable: true
        });
        w.dispatchEvent(event);
      } catch (e) {
        if (w.SEENTICS_DEBUG) console.warn(`[Seentics] Dispatch failed: ${name}`, e);
      }
    }
  };

  // --- Export ---
  w.SEENTICS_CORE = {
    KEYS: STORAGE_KEYS,
    LIMITS,
    EVENTS: EVENT_TYPES,
    ...Utils
  };

})(window);
