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
    interactions: []
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
      page_path: pageData.path,
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
      event_type: 'event',
      event_name: eventName,
      page_view_id: analytics.pageViewId,
      page_url: w.location.href,
      page_path: w.location.pathname,
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

  // Auto-tracking setup
  const setupAutoTracking = () => {
    // Track initial pageview
    trackPageView();

    // Track clicks
    d.addEventListener('click', (e) => {
      const target = e.target;
      if (target.tagName === 'A' || target.tagName === 'BUTTON') {
        trackClick(target);
      }
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
    setInterval(() => {
      if (w.location.pathname !== lastPath) {
        lastPath = w.location.pathname;
        analytics.pageLoadTime = Date.now();
        analytics.scrollDepth = 0;
        analytics.timeOnPage = 0;
        trackPageView();
      }
    }, 100);
  };

  // Listen for core ready
  S.on('core:ready', setupAutoTracking);

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

  // If core is already ready, setup immediately
  if (S.state.visitorId) {
    setupAutoTracking();
  }

})(window, document);
