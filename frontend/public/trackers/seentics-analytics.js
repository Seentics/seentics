/**
 * Seentics Analytics Tracker
 * Handles pageviews, events, and user interactions
 * Requires: seentics-core.js
 */

(function(w, d) {
  'use strict';

  const S = w.SEENTICS_CORE;
  if (!S) {
    console.error('[Seentics Analytics] Core not loaded. Include seentics-core.js first.');
    return;
  }

  // Analytics-specific state
  const analytics = {
    pageViewId: null,
    pageLoadTime: Date.now(),
    scrollDepth: 0,
    timeOnPage: 0,
    interactions: [],
    initialized: false
  };

  // Track pageview
  const trackPageView = () => {
    analytics.pageViewId = S.utils.generateId();
    const pageData = S.page.getCurrentPage();

    S.queue.add({
      event_type: 'pageview',
      event_name: 'page_view',
      page_view_id: analytics.pageViewId,
      page_url: pageData.url,
      page: pageData.path,
      page_title: pageData.title,
      referrer: pageData.referrer,
      screen_width: pageData.screen.width,
      screen_height: pageData.screen.height,
      viewport_width: pageData.viewport.width,
      viewport_height: pageData.viewport.height,
      user_agent: navigator.userAgent,
      language: navigator.language
    });

    S.emit('analytics:pageview', { pageViewId: analytics.pageViewId, ...pageData });
  };

  // Track custom event
  const trackEvent = (eventName, properties = {}) => {
    S.queue.add({
      event_type: eventName,
      page_view_id: analytics.pageViewId,
      page_url: w.location.href,
      page: w.location.pathname,
      properties
    });

    S.emit('analytics:event', { eventName, properties });
  };

  // Track click
  const trackClick = (element, properties = {}) => {
    const clickData = {
      element_tag: element.tagName.toLowerCase(),
      element_id: element.id || null,
      element_class: element.className || null,
      element_text: element.textContent?.substring(0, 100) || null,
      ...properties
    };

    trackEvent('click', clickData);
  };

  // Scroll depth tracking
  const trackScrollDepth = S.utils.debounce(() => {
    const scrollHeight = d.documentElement.scrollHeight - w.innerHeight;
    const scrolled = w.scrollY;
    const depth = Math.round((scrolled / scrollHeight) * 100);

    if (depth > analytics.scrollDepth) {
      analytics.scrollDepth = depth;

      // Track milestones
      if ([25, 50, 75, 90, 100].includes(depth)) {
        trackEvent('scroll_depth', { depth });
      }
    }
  }, 500);

  // Time on page tracking
  const updateTimeOnPage = () => {
    analytics.timeOnPage = Math.round((Date.now() - analytics.pageLoadTime) / 1000);
  };

  // Load custom goal configurations from API
  const loadGoalConfig = async () => {
    try {
      const response = await fetch(`${S.config.apiHost}/api/v1/tracker/config/${S.config.websiteId}`);
      if (!response.ok) return;
      const config = await response.json();
      
      if (config.goals && Array.isArray(config.goals)) {
        config.goals.forEach(goal => {
          if (goal.selector) {
            setupGoalListener(goal);
          }
        });
      }
    } catch (e) {
      if (S.config.debug) console.error('[Seentics] Failed to load goal config', e);
    }
  };

  // Setup listener for a specific goal selector
  const setupGoalListener = (goal) => {
    d.addEventListener('click', (e) => {
      // Check if the clicked element or its parent matches the selector
      const target = e.target.closest(goal.selector);
      if (target) {
        trackEvent(goal.name, {
          goal_id: goal.id,
          trigger: 'selector_match',
          selector: goal.selector,
          text: target.textContent?.substring(0, 50).trim()
        });
      }
    }, true);
  };

  // Auto-tracking setup
  const setupAutoTracking = () => {
    // Track initial pageview
    trackPageView();
    
    // Load custom goals
    loadGoalConfig();

    // Track clicks
    d.addEventListener('click', (e) => {
      const target = e.target.closest('a, button');
      if (target) {
        trackClick(target);
      }
    }, true);

    // Track form submissions
    d.addEventListener('submit', (e) => {
      const form = e.target;
      const formData = {};
      const inputs = form.querySelectorAll('input, select, textarea');
      
      // Sensitive field patterns to exclude
      const sensitivePatterns = [
        /password/i,
        /credit[_-]?card/i,
        /cc[_-]?number/i,
        /cvv/i,
        /ssn/i,
        /social[_-]?security/i,
        /routing[_-]?number/i,
        /account[_-]?number/i,
        /pin/i,
        /tax[_-]?id/i
      ];
      
      inputs.forEach(input => {
        const fieldName = input.name || input.id || input.tagName.toLowerCase();
        
        // Skip sensitive fields
        if (input.type === 'password' || 
            sensitivePatterns.some(pattern => pattern.test(fieldName))) {
          return;
        }
        
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.checked) formData[fieldName] = input.value;
        } else {
          formData[fieldName] = input.value;
        }
      });

      trackEvent('form_submission', {
        form_id: form.id || null,
        form_action: form.action || null,
        form_name: form.name || null,
        form_data: formData
      });
    }, true);

    // Track video interactions (HTML5 Video)
    d.querySelectorAll('video').forEach(video => {
      video.addEventListener('play', () => {
        trackEvent('video_play', {
          video_src: video.currentSrc,
          video_time: Math.round(video.currentTime)
        });
      });

      video.addEventListener('pause', () => {
        trackEvent('video_pause', {
          video_src: video.currentSrc,
          video_time: Math.round(video.currentTime)
        });
      });

      video.addEventListener('ended', () => {
        trackEvent('video_complete', {
          video_src: video.currentSrc
        });
      });
    });

    // Track scroll
    w.addEventListener('scroll', trackScrollDepth);

    // Track time on page
    setInterval(updateTimeOnPage, 1000);

    // Track page exit
    w.addEventListener('beforeunload', () => {
      updateTimeOnPage();
      trackEvent('page_exit', {
        time_on_page: analytics.timeOnPage,
        scroll_depth: analytics.scrollDepth
      });
    });

    // SPA navigation support
    let lastPath = w.location.pathname;
    
    // Use History API detection instead of polling
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    const handleNavigation = () => {
      if (w.location.pathname !== lastPath) {
        lastPath = w.location.pathname;
        analytics.pageLoadTime = Date.now();
        analytics.scrollDepth = 0;
        analytics.timeOnPage = 0;
        trackPageView();
      }
    };
    
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleNavigation();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleNavigation();
    };
    
    // Handle browser back/forward
    w.addEventListener('popstate', handleNavigation);
  };

  // Initialize
  const init = () => {
    // Prevent double init
    if (analytics.initialized) return;
    analytics.initialized = true;

    setupAutoTracking();
  };

  // Listen for core ready or init if already ready
  if (S.isReady && S.isReady()) {
    init();
  } else {
    S.on('core:ready', init);
  }

  // Public API
  w.seentics = w.seentics || {};
  w.seentics.analytics = {
    track: trackEvent,
    trackPageView,
    trackClick,
    getPageViewId: () => analytics.pageViewId,
    getTimeOnPage: () => analytics.timeOnPage,
    getScrollDepth: () => analytics.scrollDepth
  };

})(window, document);
