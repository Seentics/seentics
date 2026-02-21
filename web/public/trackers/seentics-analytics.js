/**
 * Seentics Analytics Tracker
 * Handles pageviews, events, and user interactions
 * Requires: seentics-core.js
 */
(function(w, d) {
  'use strict';
  var S = w.SEENTICS_CORE;
  if (!S) { console.error('[Seentics Analytics] Core not loaded.'); return; }

  var analytics = {
    pageViewId: null, pageLoadTime: Date.now(),
    scrollDepth: 0, timeOnPage: 0, initialized: false
  };

  var trackPageView = function() {
    analytics.pageViewId = S.utils.generateId();
    var p = S.page.getCurrentPage();
    S.queue.add({
      event_type: 'pageview', event_name: 'page_view',
      page_view_id: analytics.pageViewId,
      page_url: p.url, page: p.path, page_title: p.title, referrer: p.referrer,
      screen_width: p.screen.width, screen_height: p.screen.height,
      viewport_width: p.viewport.width, viewport_height: p.viewport.height,
      user_agent: navigator.userAgent, language: navigator.language
    });
    S.emit('analytics:pageview', { pageViewId: analytics.pageViewId, url: p.url, path: p.path, title: p.title, referrer: p.referrer });
  };

  var trackEvent = function(eventName, properties) {
    S.queue.add({
      event_type: eventName, page_view_id: analytics.pageViewId,
      page_url: w.location.href, page: w.location.pathname,
      properties: properties || {}
    });
    S.emit('analytics:event', { eventName: eventName, properties: properties || {} });
  };

  var trackClick = function(el, properties) {
    trackEvent('click', Object.assign({
      element_tag: el.tagName.toLowerCase(),
      element_id: el.id || null,
      element_class: el.className || null,
      element_text: (el.textContent || '').substring(0, 100) || null
    }, properties || {}));
  };

  // Scroll depth — only major milestones
  var trackScrollDepth = S.utils.debounce(function() {
    var scrollH = d.documentElement.scrollHeight - w.innerHeight;
    if (scrollH <= 0) return;
    var depth = Math.round((w.scrollY / scrollH) * 100);
    if (depth > analytics.scrollDepth) {
      analytics.scrollDepth = depth;
      if (depth === 50 || depth === 100) trackEvent('scroll_depth', { depth: depth });
    }
  }, 500);

  var updateTimeOnPage = function() {
    analytics.timeOnPage = Math.round((Date.now() - analytics.pageLoadTime) / 1000);
  };

  // High-value element detection for auto-tracking
  var HIGH_VALUE_TEXTS = ['buy','purchase','checkout','add to cart','add to bag','subscribe','sign up','signup','register','join','get started','start free','try free','free trial','download','install','get now','contact','request','demo','schedule','upgrade','pro','premium','pricing','submit','send','confirm','complete','book','reserve','order','learn more','view plans','see pricing'];
  var HIGH_VALUE_PATTERNS = ['cta','call-to-action','primary-button','action-button','add-cart','add-to-cart','buy-button','purchase','checkout','subscribe','signup','register','submit','download','pricing','plan','upgrade','pro','premium'];
  var HIGH_VALUE_PATHS = ['/checkout','/cart','/basket','/signup','/register','/join','/pricing','/plans','/upgrade','/demo','/contact','/trial','/download','/subscribe'];

  var isHighValueElement = function(el) {
    if (!el) return false;
    var text = (el.textContent || '').toLowerCase().trim();
    var id = (el.id || '').toLowerCase();
    var cls = (el.className || '').toLowerCase();
    var href = (el.href || '').toLowerCase();
    return HIGH_VALUE_TEXTS.some(function(p) { return text.includes(p); }) ||
           HIGH_VALUE_PATTERNS.some(function(p) { return cls.includes(p) || id.includes(p); }) ||
           HIGH_VALUE_PATHS.some(function(p) { return href.includes(p); }) ||
           el.type === 'submit' || (el.tagName === 'BUTTON' && el.closest('form'));
  };

  // Sensitive fields to exclude from form tracking
  var SENSITIVE = [/password/i,/credit[_-]?card/i,/cc[_-]?number/i,/cvv/i,/ssn/i,/social[_-]?security/i,/routing[_-]?number/i,/account[_-]?number/i,/pin/i,/tax[_-]?id/i];

  // Setup goal listeners from core's already-fetched config
  var setupGoals = function() {
    var goals = S.config.goals;
    if (!goals || !Array.isArray(goals)) return;
    goals.forEach(function(goal) {
      if (goal.selector) {
        d.addEventListener('click', function(e) {
          var target = e.target.closest(goal.selector);
          if (target) {
            trackEvent(goal.name, {
              goal_id: goal.id, trigger: 'selector_match',
              selector: goal.selector, text: (target.textContent || '').substring(0, 50).trim()
            });
          }
        }, true);
      }
    });
  };

  var setupAutoTracking = function() {
    trackPageView();
    setupGoals();

    // Click tracking: explicit or high-value auto-detection
    d.addEventListener('click', function(e) {
      var target = e.target.closest('a, button, [role="button"]');
      if (!target) return;
      if (target.hasAttribute('data-track') || target.hasAttribute('data-track-click') ||
          target.classList.contains('track-click') || isHighValueElement(target)) {
        trackClick(target);
      }
    }, true);

    // Form submissions
    d.addEventListener('submit', function(e) {
      var form = e.target;
      var inputs = form.querySelectorAll('input, select, textarea');
      var formId = form.id || '', formClass = form.className || '', formAction = (form.action || '').toLowerCase();
      var formType = 'generic';
      ['contact','signup','subscribe','checkout','login','search'].forEach(function(t) {
        if (formId.includes(t) || formClass.includes(t) || formAction.includes(t)) {
          formType = t === 'subscribe' ? 'newsletter' : t;
        }
      });

      var formData = {};
      inputs.forEach(function(input) {
        var name = input.name || input.id || input.tagName.toLowerCase();
        if (input.type === 'password' || SENSITIVE.some(function(p) { return p.test(name); })) return;
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.checked) formData[name] = input.value;
        } else {
          formData[name] = input.value;
        }
      });

      trackEvent('form_submission', {
        form_id: form.id || null, form_action: form.action || null,
        form_name: form.name || null, form_type: formType,
        field_count: inputs.length, form_data: formData
      });
    }, true);

    // Video tracking
    d.querySelectorAll('video').forEach(function(video) {
      var milestones = new Set();
      video.addEventListener('play', function() {
        trackEvent('video_play', { video_src: video.currentSrc, video_time: Math.round(video.currentTime) });
      });
      video.addEventListener('timeupdate', function() {
        var pct = Math.round((video.currentTime / video.duration) * 100);
        [25,50,75,100].forEach(function(m) {
          if (pct >= m && !milestones.has(m)) {
            milestones.add(m);
            trackEvent('video_progress', { video_src: video.currentSrc, milestone: m });
          }
        });
      });
      video.addEventListener('ended', function() {
        trackEvent('video_complete', { video_src: video.currentSrc });
      });
    });

    // Product/gallery/hero image clicks
    d.addEventListener('click', function(e) {
      var img = e.target.closest('img');
      if (!img) return;
      var ctx = img.closest('.product, [class*="product"]') ? 'product' :
                img.closest('.gallery, [class*="gallery"]') ? 'gallery' :
                img.closest('.hero, [class*="hero"]') ? 'hero' : null;
      if (ctx) trackEvent('image_click', { image_src: img.src, image_alt: img.alt || null, context: ctx });
    }, true);

    w.addEventListener('scroll', trackScrollDepth, { passive: true });
    setInterval(updateTimeOnPage, 1000);

    w.addEventListener('beforeunload', function() {
      updateTimeOnPage();
      trackEvent('page_exit', { time_on_page: analytics.timeOnPage, scroll_depth: analytics.scrollDepth });
    });

    // SPA navigation via History API
    var lastPath = w.location.pathname;
    var handleNav = function() {
      if (w.location.pathname !== lastPath) {
        lastPath = w.location.pathname;
        analytics.pageLoadTime = Date.now();
        analytics.scrollDepth = 0;
        analytics.timeOnPage = 0;
        trackPageView();
      }
    };
    var origPush = history.pushState, origReplace = history.replaceState;
    history.pushState = function() { origPush.apply(this, arguments); handleNav(); };
    history.replaceState = function() { origReplace.apply(this, arguments); handleNav(); };
    w.addEventListener('popstate', handleNav);
  };

  var init = function() {
    if (analytics.initialized) return;
    analytics.initialized = true;
    setupAutoTracking();
  };

  if (S.isReady && S.isReady()) init();
  else S.on('core:ready', init);

  w.seentics = w.seentics || {};
  w.seentics.analytics = {
    track: trackEvent, trackPageView: trackPageView, trackClick: trackClick,
    getPageViewId: function() { return analytics.pageViewId; },
    getTimeOnPage: function() { return analytics.timeOnPage; },
    getScrollDepth: function() { return analytics.scrollDepth; }
  };
})(window, document);
