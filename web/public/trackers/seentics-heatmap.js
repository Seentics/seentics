/**
 * Seentics Heatmap Tracker
 * Captures mouse movements and clicks for heatmap visualization
 */

(function(w, d) {
  'use strict';

    // We allow initialization in iframes so we can respond to dimension requests from the dashboard
    const isIframe = w !== w.top;

  // Wait for Core to be ready
  if (!w.SEENTICS_CORE) {
    const checkCore = setInterval(() => {
      if (w.SEENTICS_CORE) {
        clearInterval(checkCore);
        initHeatmap();
      }
    }, 100);
    return;
  }

  initHeatmap();

  function initHeatmap() {
    const core = w.SEENTICS_CORE;
    const config = core.config;
    const state = core.state;

    // Heatmap specific state
    const heatmapState = {
      buffer: [],
      maxBufferSize: 100,
      flushInterval: 30000, // 30 seconds
      lastMoveTime: 0,
      moveThreshold: 150, // 150ms between move captures
      lastMoveX: -1,
      lastMoveY: -1,
      minMoveDistance: 1, // 0.1% increments
      gridSize: 1, // Maximum precision (0.1% grid)
      lastUrl: w.location.href,
      samplingRate: 0.1, // Sample 10% of mousemove events
      // Default to true; if remote config explicitly disables, we respect that
      enabled: config.heatmap_enabled !== false
    };

    // Check plan limits (only when a positive limit is set; 0 = unset/unknown, -1 = unlimited)
    const currentPath = w.location.pathname;
    const maxHeatmaps = config.max_heatmaps || 0;
    const trackedUrls = config.tracked_urls || [];
    const isTracked = trackedUrls.includes(currentPath);

    if (heatmapState.enabled && maxHeatmaps > 0) {
      if (!isTracked && trackedUrls.length >= maxHeatmaps) {
        heatmapState.enabled = false;
        if (config.debug) {
          console.log('[Seentics Heatmap] Limit reached, skipping this page:', currentPath);
        }
      }
    }

    if (!heatmapState.enabled && !isIframe) return;

    if (!isIframe) {
      if (!trackedUrls.includes(currentPath)) {
        trackedUrls.push(currentPath);
      }
    }

    /**
     * Normalize and Bin coordinates to 0-1000 range with grid clamping
     */
    const getDimensions = () => {
      const doc = d.documentElement;
      const body = d.body || { scrollHeight: 0, offsetHeight: 0, clientWidth: 0 };
      const bodyRect = body.getBoundingClientRect ? body.getBoundingClientRect() : { width: doc.clientWidth, left: 0 };
      
      return {
        // Horizontal: USE BODY WIDTH as stable layout basis. 
        // If body is centered (margin: auto), this is the actual content width.
        width: bodyRect.width || doc.clientWidth || w.innerWidth,
        // Absolute left offset of body in the document
        left: bodyRect.left + (w.pageXOffset || doc.scrollLeft),
        // Vertical: Document-relative basis
        height: Math.max(
          body.scrollHeight || 0, doc.scrollHeight,
          body.offsetHeight || 0, doc.offsetHeight,
          doc.clientHeight
        )
      };
    };

    const getNormalizedCoords = (e) => {
      const dims = getDimensions();
      const basisWidth = dims.width || 1;
      const basisHeight = dims.height || 1;
      const deviceType = getDeviceType();

      let x = 0;
      
      if (deviceType === 'desktop' || deviceType === 'tablet') {
        // Industry standard heatmap logic for fixed/centered layouts:
        // Calculate the physical pixel offset from the center of the user's screen.
        const targetWidth = deviceType === 'desktop' ? 1200 : 768;
        const currentCenter = dims.left + (basisWidth / 2);
        const distanceFromCenter = e.pageX - currentCenter;
        
        // Map that exact offset to the center of the simulated dashboard iframe viewport
        const projectedX = (targetWidth / 2) + distanceFromCenter;
        
        // Convert to the 0-1000 scale expected by the backend
        x = (projectedX / targetWidth) * 1000;
      } else {
        // Mobile is predominantly fluid (100% width), so raw percentage works best
        x = ((e.pageX - dims.left) / basisWidth) * 1000;
      }

      // Y: Percentage of the full document height
      let y = (e.pageY / basisHeight) * 1000;

      return {
        // Allow x to exceed 0-1000 range if users click wide margins on large monitors
        x: x,
        // Keep Y clamped conceptually
        y: Math.min(1000, Math.max(0, y))
      };
    };

    const normalizePath = (path) => {
      if (!path) return '/';
      // Remove trailing slash except for root
      return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
    };

    /**
     * Generate a unique CSS selector for an element
     */
    const getSelector = (el) => {
      if (!(el instanceof Element)) return '';
      const path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
          selector += '#' + el.id;
          path.unshift(selector);
          break;
        } else {
          let sib = el, nth = 1;
          while (sib = sib.previousElementSibling) {
            if (sib.nodeName.toLowerCase() == selector) nth++;
          }
          if (nth != 1) selector += ':nth-of-type(' + nth + ')';
        }
        path.unshift(selector);
        el = el.parentNode;
      }
      return path.join(' > ');
    };

    /**
     * Detect device type based on screen width
     */
    const getDeviceType = () => {
      const width = w.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    };

    /**
     * Add point to buffer
     */
    const addPoint = (type, x, y, selector = '') => {
      if (!heatmapState.enabled) return;
      heatmapState.buffer.push({
        type: type, // 'click' or 'move'
        x: x,
        y: y,
        selector: selector,
        url: normalizePath(w.location.pathname),
        device_type: getDeviceType(),
        timestamp: Math.floor(Date.now() / 1000)
      });

      if (heatmapState.buffer.length >= heatmapState.maxBufferSize) {
        flushBuffer();
      }
    };

    /**
     * Send buffered points to API
     */
    const flushBuffer = async () => {
      if (heatmapState.buffer.length === 0) return;

      const points = [...heatmapState.buffer];
      heatmapState.buffer = [];

      try {
        const response = await fetch(`${config.apiHost}/api/v1/heatmaps/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            website_id: config.websiteId,
            points: points
          })
        });

        if (!response.ok && config.debug) {
          console.error('[Seentics Heatmap] Failed to send points', await response.text());
        }
      } catch (err) {
        if (config.debug) {
          console.error('[Seentics Heatmap] Error sending points', err);
        }
      }
    };

    /**
     * Handle messages from the Seentics dashboard (for heatmap viewer)
     */
    w.addEventListener('message', (event) => {
      // Security: You might want to check event.origin if you know it
      if (event.data === 'SEENTICS_GET_DIMENSIONS') {
        const dims = getDimensions();
        let scrollHeight = dims.height;
        let scrollWidth = dims.width;

        // Smart check for fixed-height apps with internal scrolling
        if (scrollHeight <= w.innerHeight + 100) {
           try {
              const allElems = d.querySelectorAll('div, main, section');
              for (let i = 0; i < allElems.length; i++) {
                 const el = allElems[i];
                 if (el.scrollHeight > scrollHeight && el.scrollHeight < 10000) { // sanity check
                     const style = w.getComputedStyle(el);
                     if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && style.display !== 'none') {
                         scrollHeight = el.scrollHeight;
                         if (el.scrollWidth > scrollWidth) scrollWidth = el.scrollWidth;
                     }
                 }
              }
           } catch (e) {}
        }
        
        event.source.postMessage({
          type: 'SEENTICS_DIMENSIONS',
          height: scrollHeight,
          width: dims.width, // The content width
          left: dims.left - (w.pageXOffset || d.documentElement.scrollLeft), // Viewport-relative left
          totalWidth: dims.width,
          url: w.location.href
        }, '*');
      }

      // Handle remote scroll command from dashboard
      if (event.data?.type === 'SEENTICS_SET_SCROLL') {
        w.scrollTo(event.data.left || 0, event.data.top || 0);
      }
    });

    // Send scroll position to parent for heatmap alignment
    w.addEventListener('scroll', () => {
      const scrollTop = w.pageYOffset || d.documentElement.scrollTop;
      const scrollLeft = w.pageXOffset || d.documentElement.scrollLeft;
      
      if (w.parent !== w) {
        w.parent.postMessage({
          type: 'SEENTICS_SCROLL',
          scrollTop: scrollTop,
          scrollLeft: scrollLeft
        }, '*');
      }
    }, { passive: true });
    
    if (!isIframe) {
      // Record a pageview point so the pages list shows view counts
      addPoint('pageview', 0, 0);

      // Capture movements with sampling and distance threshold
      d.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - heatmapState.lastMoveTime < heatmapState.moveThreshold) return;
        
        // Random sampling to reduce data volume
        if (Math.random() > heatmapState.samplingRate) return;
        
        const coords = getNormalizedCoords(e);
        
        // Distance threshold check
        const dx = Math.abs(coords.x - heatmapState.lastMoveX);
        const dy = Math.abs(coords.y - heatmapState.lastMoveY);
        if (dx < heatmapState.minMoveDistance && dy < heatmapState.minMoveDistance) return;

        heatmapState.lastMoveTime = now;
        heatmapState.lastMoveX = coords.x;
        heatmapState.lastMoveY = coords.y;
        
        addPoint('move', coords.x, coords.y);
      });

      // Listen for clicks with selector capture
      d.addEventListener('click', (e) => {
        const coords = getNormalizedCoords(e);
        const selector = getSelector(e.target);
        addPoint('click', coords.x, coords.y, selector);
      });

      // Flush on page leave or interval
      setInterval(flushBuffer, heatmapState.flushInterval);

      // Use sendBeacon on unload so the request survives page close
      w.addEventListener('beforeunload', () => {
        if (heatmapState.buffer.length === 0) return;
        const payload = JSON.stringify({
          website_id: config.websiteId,
          points: heatmapState.buffer
        });
        navigator.sendBeacon(
          `${config.apiHost}/api/v1/heatmaps/record`,
          new Blob([payload], { type: 'application/json' })
        );
        heatmapState.buffer = [];
      });

      // Flush when tab becomes hidden (tab switch, mobile background, most SPA navigations)
      d.addEventListener('visibilitychange', () => {
        if (d.visibilityState === 'hidden') flushBuffer();
      });

      // Watch for SPA navigation via History API (cheaper than MutationObserver)
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const handleNavigation = () => {
        const currentPath = normalizePath(w.location.pathname);
        if (currentPath !== normalizePath(new URL(heatmapState.lastUrl).pathname)) {
          flushBuffer(); // flush previous page's data first
          heatmapState.lastUrl = w.location.href;

          // Re-check limit for the new page
          if (maxHeatmaps > 0) {
            const newPath = normalizePath(w.location.pathname);
            const newIsTracked = trackedUrls.includes(newPath);
            heatmapState.enabled = newIsTracked || trackedUrls.length < maxHeatmaps;
            if (!heatmapState.enabled && config.debug) {
              console.log('[Seentics Heatmap] Limit reached, skipping new page:', newPath);
            }
          }

          // Record a pageview for the new page if tracking is enabled
          if (heatmapState.enabled) {
            const newPath = normalizePath(w.location.pathname);
            // Keep trackedUrls up-to-date in memory so the next navigation
            // limit check sees the correct count (the remote config snapshot is stale).
            if (!trackedUrls.includes(newPath)) {
              trackedUrls.push(newPath);
            }
            addPoint('pageview', 0, 0);
          }
        }
      };
      history.pushState = function(...args) { originalPushState.apply(this, args); handleNavigation(); };
      history.replaceState = function(...args) { originalReplaceState.apply(this, args); handleNavigation(); };
      w.addEventListener('popstate', handleNavigation);
    }

    if (config.debug) {
      console.log('[Seentics Heatmap] Optimized tracker initialized');
    }
  }

})(window, document);
