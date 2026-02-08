/**
 * Seentics Heatmap Tracker
 * Captures mouse movements and clicks for heatmap visualization
 */

(function(w, d) {
  'use strict';

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
      maxBufferSize: 50,
      flushInterval: 5000, // 5 seconds
      lastMoveTime: 0,
      moveThreshold: 150, // 150ms between move captures
      lastUrl: w.location.href,
      samplingRate: 0.1 // Sample 10% of mousemove events (configurable)
    };

    /**
     * Normalize coordinates to 0-1000 range
     */
    const getNormalizedCoords = (e) => {
      const doc = d.documentElement;
      const scrollWidth = Math.max(doc.scrollWidth, doc.offsetWidth, doc.clientWidth);
      const scrollHeight = Math.max(doc.scrollHeight, doc.offsetHeight, doc.clientHeight);

      const x = (e.pageX / scrollWidth) * 1000;
      const y = (e.pageY / scrollHeight) * 1000;

      return {
        x: Math.round(Math.min(1000, Math.max(0, x))),
        y: Math.round(Math.min(1000, Math.max(0, y)))
      };
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
    const addPoint = (type, x, y) => {
      heatmapState.buffer.push({
        type: type, // 'click' or 'move'
        x: x,
        y: y,
        url: w.location.pathname,
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
        // If it failed, we might want to put them back in the buffer, 
        // but for high volume data like moves, we can just drop them to avoid bloat.
      }
    };

    /**
     * Handle messages from the Seentics dashboard (for heatmap viewer)
     */
    w.addEventListener('message', (event) => {
      // Security: You might want to check event.origin if you know it
      if (event.data === 'SEENTICS_GET_DIMENSIONS') {
        const doc = d.documentElement;
        const body = d.body;
        
        // Comprehensive height check
        const scrollHeight = Math.max(
          body.scrollHeight, body.offsetHeight, 
          doc.clientHeight, doc.scrollHeight, doc.offsetHeight
        );
        const scrollWidth = Math.max(
          body.scrollWidth, body.offsetWidth, 
          doc.clientWidth, doc.scrollWidth, doc.offsetWidth
        );
        
        event.source.postMessage({
          type: 'SEENTICS_DIMENSIONS',
          height: scrollHeight,
          width: scrollWidth,
          url: w.location.href
        }, '*');
      }

      // Handle remote scroll command from dashboard
      if (event.data?.type === 'SEENTICS_SET_SCROLL') {
        w.scrollTo(event.data.left || 0, event.data.top || 0);
      }
    });    // Send scroll position to parent for heatmap alignment
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

    // Capture movements with sampling
    d.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - heatmapState.lastMoveTime < heatmapState.moveThreshold) return;
      
      // Random sampling to reduce data volume
      if (Math.random() > heatmapState.samplingRate) return;
      
      heatmapState.lastMoveTime = now;
      const coords = getNormalizedCoords(e);
      addPoint('move', coords.x, coords.y);
    });

    // Listen for clicks
    d.addEventListener('click', (e) => {
      const coords = getNormalizedCoords(e);
      addPoint('click', coords.x, coords.y);
    });

    // Flush on page leave or interval
    setInterval(flushBuffer, heatmapState.flushInterval);
    w.addEventListener('beforeunload', flushBuffer);

    // Watch for SPA navigation
    const observer = new MutationObserver(() => {
      if (w.location.href !== heatmapState.lastUrl) {
        heatmapState.lastUrl = w.location.href;
        flushBuffer();
      }
    });
    observer.observe(d.body, { childList: true, subtree: true });

    if (config.debug) {
      console.log('[Seentics Heatmap] Initialized');
    }
  }

})(window, document);
