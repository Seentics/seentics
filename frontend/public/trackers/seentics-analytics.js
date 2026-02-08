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

  // Scroll depth tracking - only track significant milestones
  const trackScrollDepth = S.utils.debounce(() => {
    const scrollHeight = d.documentElement.scrollHeight - w.innerHeight;
    const scrolled = w.scrollY;
    const depth = Math.round((scrolled / scrollHeight) * 100);

    if (depth > analytics.scrollDepth) {
      analytics.scrollDepth = depth;

      // Only track major milestones (50%, 100%) to reduce noise
      if ([50, 100].includes(depth)) {
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

  // High-value patterns for auto-tracking
  const isHighValueElement = (element) => {
    if (!element) return false;
    
    const text = (element.textContent || '').toLowerCase().trim();
    const id = (element.id || '').toLowerCase();
    const className = (element.className || '').toLowerCase();
    const href = (element.href || '').toLowerCase();
    
    // High-value text patterns (actions that indicate conversion intent)
    const highValueTexts = [
      'buy', 'purchase', 'checkout', 'add to cart', 'add to bag',
      'subscribe', 'sign up', 'signup', 'register', 'join',
      'get started', 'start free', 'try free', 'free trial',
      'download', 'install', 'get now',
      'contact', 'request', 'demo', 'schedule',
      'upgrade', 'pro', 'premium', 'pricing',
      'submit', 'send', 'confirm', 'complete',
      'book', 'reserve', 'order',
      'learn more', 'view plans', 'see pricing'
    ];
    
    // High-value class/ID patterns
    const highValuePatterns = [
      'cta', 'call-to-action', 'primary-button', 'action-button',
      'add-cart', 'add-to-cart', 'buy-button', 'purchase',
      'checkout', 'subscribe', 'signup', 'register',
      'submit', 'download', 'pricing', 'plan',
      'upgrade', 'pro', 'premium'
    ];
    
    // High-value href patterns
    const highValuePaths = [
      '/checkout', '/cart', '/basket',
      '/signup', '/register', '/join',
      '/pricing', '/plans', '/upgrade',
      '/demo', '/contact', '/trial',
      '/download', '/subscribe'
    ];
    
    // Check text content
    const hasHighValueText = highValueTexts.some(pattern => text.includes(pattern));
    
    // Check class/ID
    const hasHighValueClass = highValuePatterns.some(pattern => 
      className.includes(pattern) || id.includes(pattern)
    );
    
    // Check href
    const hasHighValuePath = highValuePaths.some(path => href.includes(path));
    
    // Check for form submit buttons
    const isFormSubmit = element.type === 'submit' || 
                         (element.tagName === 'BUTTON' && element.closest('form'));
    
    return hasHighValueText || hasHighValueClass || hasHighValuePath || isFormSubmit;
  };

  // Auto-tracking setup
  const setupAutoTracking = () => {
    // Track initial pageview
    trackPageView();
    
    // Load custom goals
    loadGoalConfig();

    // Smart click tracking: explicit tracking OR high-value auto-detection
    d.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, [role="button"]');
      if (!target) return;
      
      // Priority 1: Explicitly marked for tracking (user-defined)
      const explicitlyTracked = target.hasAttribute('data-track') || 
                                target.hasAttribute('data-track-click') ||
                                target.classList.contains('track-click');
      
      // Priority 2: Auto-detect high-value elements
      const isHighValue = isHighValueElement(target);
      
      if (explicitlyTracked || isHighValue) {
        trackClick(target);
      }
    }, true);

    // Track form submissions (all forms are considered high-value)
    d.addEventListener('submit', (e) => {
      const form = e.target;
      const formData = {};
      const inputs = form.querySelectorAll('input, select, textarea');
      
      // Identify form type based on fields and context
      const formId = form.id || '';
      const formClass = form.className || '';
      const formAction = (form.action || '').toLowerCase();
      
      let formType = 'generic';
      if (formId.includes('contact') || formClass.includes('contact') || formAction.includes('contact')) {
        formType = 'contact';
      } else if (formId.includes('signup') || formClass.includes('signup') || formAction.includes('signup')) {
        formType = 'signup';
      } else if (formId.includes('subscribe') || formClass.includes('subscribe') || formAction.includes('subscribe')) {
        formType = 'newsletter';
      } else if (formId.includes('checkout') || formClass.includes('checkout') || formAction.includes('checkout')) {
        formType = 'checkout';
      } else if (formId.includes('login') || formClass.includes('login') || formAction.includes('login')) {
        formType = 'login';
      } else if (formId.includes('search') || formClass.includes('search') || formAction.includes('search')) {
        formType = 'search';
      }
      
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
        form_type: formType,
        field_count: inputs.length,
        form_data: formData
      });
    }, true);

    // Track video interactions (HTML5 Video) - high engagement indicator
    d.querySelectorAll('video').forEach(video => {
      let watchedMilestones = new Set();
      
      video.addEventListener('play', () => {
        trackEvent('video_play', {
          video_src: video.currentSrc,
          video_time: Math.round(video.currentTime)
        });
      });

      // Track viewing milestones (25%, 50%, 75%, 100%)
      video.addEventListener('timeupdate', () => {
        const percent = Math.round((video.currentTime / video.duration) * 100);
        const milestones = [25, 50, 75, 100];
        
        milestones.forEach(milestone => {
          if (percent >= milestone && !watchedMilestones.has(milestone)) {
            watchedMilestones.add(milestone);
            trackEvent('video_progress', {
              video_src: video.currentSrc,
              milestone: milestone
            });
          }
        });
      });

      video.addEventListener('ended', () => {
        trackEvent('video_complete', {
          video_src: video.currentSrc
        });
      });
    });
    
    // Track important image clicks (product images, hero images)
    d.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      
      // Only track images with specific classes or in specific contexts
      const isProductImage = img.classList.contains('product-image') || 
                            img.closest('.product') || 
                            img.closest('[class*="product"]');
      const isGalleryImage = img.closest('.gallery') || 
                            img.closest('[class*="gallery"]');
      const isHeroImage = img.closest('.hero') || 
                         img.closest('[class*="hero"]');
      
      if (isProductImage || isGalleryImage || isHeroImage) {
        trackEvent('image_click', {
          image_src: img.src,
          image_alt: img.alt || null,
          context: isProductImage ? 'product' : isGalleryImage ? 'gallery' : 'hero'
        });
      }
    }, true);

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
