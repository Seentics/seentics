/**
 * Seentics Heatmap Tracker
 * Captures mouse movements and clicks for heatmap visualization
 */
(function(w, d) {
  'use strict';
  var isIframe = w !== w.top;

  if (!w.SEENTICS_CORE) {
    var check = setInterval(function() {
      if (w.SEENTICS_CORE) { clearInterval(check); initHeatmap(); }
    }, 100);
    return;
  }
  initHeatmap();

  function initHeatmap() {
    var core = w.SEENTICS_CORE, config = core.config, state = core.state;

    var hs = {
      buffer: [], maxBufferSize: 100, flushInterval: 30000,
      lastMoveTime: 0, moveThreshold: 150,
      lastMoveX: -1, lastMoveY: -1, minMoveDistance: 1,
      lastUrl: w.location.href, samplingRate: 0.1,
      enabled: config.heatmap_enabled !== false
    };

    var currentPath = w.location.pathname;
    var maxHeatmaps = config.max_heatmaps || 0;
    var trackedUrls = config.tracked_urls || [];
    var isTracked = trackedUrls.includes(currentPath);

    if (hs.enabled && maxHeatmaps > 0 && !isTracked && trackedUrls.length >= maxHeatmaps) {
      hs.enabled = false;
    }
    if (!hs.enabled && !isIframe) return;
    if (!isIframe && !trackedUrls.includes(currentPath)) trackedUrls.push(currentPath);

    var getDimensions = function() {
      var doc = d.documentElement;
      var body = d.body || { scrollHeight: 0, offsetHeight: 0, clientWidth: 0 };
      var rect = body.getBoundingClientRect ? body.getBoundingClientRect() : { width: doc.clientWidth, left: 0 };
      return {
        width: rect.width || doc.clientWidth || w.innerWidth,
        left: rect.left + (w.pageXOffset || doc.scrollLeft),
        height: Math.max(body.scrollHeight || 0, doc.scrollHeight, body.offsetHeight || 0, doc.offsetHeight, doc.clientHeight)
      };
    };

    var getDeviceType = function() {
      var width = w.innerWidth;
      return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
    };

    var getNormalizedCoords = function(e) {
      var dims = getDimensions();
      var bw = dims.width || 1, bh = dims.height || 1;
      var dt = getDeviceType();
      var x;

      if (dt === 'desktop' || dt === 'tablet') {
        var tw = dt === 'desktop' ? 1200 : 768;
        var center = dims.left + (bw / 2);
        x = ((tw / 2) + (e.pageX - center)) / tw * 1000;
      } else {
        x = ((e.pageX - dims.left) / bw) * 1000;
      }

      return { x: x, y: Math.min(1000, Math.max(0, (e.pageY / bh) * 1000)) };
    };

    var normalizePath = function(p) {
      if (!p) return '/';
      return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
    };

    var getSelector = function(el) {
      if (!(el instanceof Element)) return '';
      var path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        var sel = el.nodeName.toLowerCase();
        if (el.id) { path.unshift(sel + '#' + el.id); break; }
        var sib = el, nth = 1;
        while (sib = sib.previousElementSibling) { if (sib.nodeName.toLowerCase() === sel) nth++; }
        if (nth !== 1) sel += ':nth-of-type(' + nth + ')';
        path.unshift(sel);
        el = el.parentNode;
      }
      return path.join(' > ');
    };

    var addPoint = function(type, x, y, selector) {
      if (!hs.enabled) return;
      hs.buffer.push({
        type: type, x: x, y: y, selector: selector || '',
        url: normalizePath(w.location.pathname),
        device_type: getDeviceType(),
        timestamp: Math.floor(Date.now() / 1000)
      });
      if (hs.buffer.length >= hs.maxBufferSize) flushBuffer();
    };

    var flushBuffer = function() {
      if (hs.buffer.length === 0) return;
      var points = hs.buffer.slice();
      hs.buffer = [];
      fetch(config.apiHost + '/api/v1/heatmaps/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_id: config.websiteId, points: points })
      }).catch(function(err) {
        if (config.debug) console.error('[Seentics Heatmap]', err);
      });
    };

    // Dashboard communication
    w.addEventListener('message', function(event) {
      if (event.data === 'SEENTICS_GET_DIMENSIONS') {
        var dims = getDimensions();
        var sh = dims.height, sw = dims.width;
        if (sh <= w.innerHeight + 100) {
          try {
            var els = d.querySelectorAll('div, main, section');
            for (var i = 0; i < els.length; i++) {
              var el = els[i];
              if (el.scrollHeight > sh && el.scrollHeight < 10000) {
                var style = w.getComputedStyle(el);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && style.display !== 'none') {
                  sh = el.scrollHeight;
                  if (el.scrollWidth > sw) sw = el.scrollWidth;
                }
              }
            }
          } catch(e) {}
        }
        event.source.postMessage({
          type: 'SEENTICS_DIMENSIONS', height: sh, width: dims.width,
          left: dims.left - (w.pageXOffset || d.documentElement.scrollLeft),
          totalWidth: dims.width, url: w.location.href
        }, '*');
      }
      if (event.data && event.data.type === 'SEENTICS_SET_SCROLL') {
        w.scrollTo(event.data.left || 0, event.data.top || 0);
      }
    });

    w.addEventListener('scroll', function() {
      if (w.parent !== w) {
        w.parent.postMessage({
          type: 'SEENTICS_SCROLL',
          scrollTop: w.pageYOffset || d.documentElement.scrollTop,
          scrollLeft: w.pageXOffset || d.documentElement.scrollLeft
        }, '*');
      }
    }, { passive: true });

    if (!isIframe) {
      addPoint('pageview', 0, 0);

      // === SCROLL DEPTH TRACKING ===
      var scrollState = {
        maxDepth: 0, sentBands: {}, lastScrollTime: 0
      };
      var recordScrollBands = function() {
        var scrollTop = w.pageYOffset || d.documentElement.scrollTop;
        var viewportHeight = w.innerHeight;
        var dims = getDimensions();
        var docHeight = dims.height || 1;
        var bottomDepth = Math.min(1000, Math.round(((scrollTop + viewportHeight) / docHeight) * 1000));
        if (bottomDepth <= scrollState.maxDepth) return;
        scrollState.maxDepth = bottomDepth;
        for (var band = 0; band <= bottomDepth; band += 50) {
          if (!scrollState.sentBands[band]) {
            scrollState.sentBands[band] = true;
            addPoint('scroll', 500, band);
          }
        }
      };
      w.addEventListener('scroll', function() {
        var now = Date.now();
        if (now - scrollState.lastScrollTime < 2000) return;
        scrollState.lastScrollTime = now;
        recordScrollBands();
      }, { passive: true });
      setTimeout(recordScrollBands, 1000);

      // === MOUSE MOVEMENT ===
      d.addEventListener('mousemove', function(e) {
        var now = Date.now();
        if (now - hs.lastMoveTime < hs.moveThreshold) return;
        if (Math.random() > hs.samplingRate) return;
        var coords = getNormalizedCoords(e);
        if (Math.abs(coords.x - hs.lastMoveX) < hs.minMoveDistance &&
            Math.abs(coords.y - hs.lastMoveY) < hs.minMoveDistance) return;
        hs.lastMoveTime = now;
        hs.lastMoveX = coords.x;
        hs.lastMoveY = coords.y;
        addPoint('move', coords.x, coords.y);
      }, { passive: true });

      // === CLICK TRACKING with RAGE + DEAD CLICK DETECTION ===
      var clickHistory = [];
      d.addEventListener('click', function(e) {
        var coords = getNormalizedCoords(e);
        var selector = getSelector(e.target);
        var now = Date.now();

        // Record normal click
        addPoint('click', coords.x, coords.y, selector);

        // --- Rage click detection: 3+ clicks within 1s on same element ---
        clickHistory.push({ time: now, selector: selector, x: coords.x, y: coords.y });
        var recentClicks = [];
        for (var i = 0; i < clickHistory.length; i++) {
          if (now - clickHistory[i].time < 1000) recentClicks.push(clickHistory[i]);
        }
        clickHistory = recentClicks;
        var sameCount = 0;
        for (var j = 0; j < recentClicks.length; j++) {
          if (recentClicks[j].selector === selector) sameCount++;
        }
        if (sameCount >= 3) {
          addPoint('rage_click', coords.x, coords.y, selector);
          clickHistory = [];
        }

        // --- Dead click detection: click on interactive element with no effect ---
        var el = e.target;
        var tag = el.tagName ? el.tagName.toLowerCase() : '';
        var isInteractive = tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select';
        if (!isInteractive && el.getAttribute) {
          isInteractive = el.getAttribute('role') === 'button' || !!el.getAttribute('onclick');
        }
        if (!isInteractive) {
          var parent = el.parentElement;
          for (var k = 0; k < 3 && parent; k++) {
            var ptag = parent.tagName ? parent.tagName.toLowerCase() : '';
            if (ptag === 'a' || ptag === 'button' || (parent.getAttribute && parent.getAttribute('role') === 'button')) {
              isInteractive = true; break;
            }
            parent = parent.parentElement;
          }
        }
        if (isInteractive) {
          var urlBefore = w.location.href;
          var domChanged = false;
          var obs = new MutationObserver(function() { domChanged = true; });
          try { obs.observe(d.body, { childList: true, subtree: true, attributes: true }); } catch(ex) {}
          setTimeout(function() {
            obs.disconnect();
            if (!domChanged && w.location.href === urlBefore) {
              addPoint('dead_click', coords.x, coords.y, selector);
            }
          }, 1000);
        }
      });

      setInterval(flushBuffer, hs.flushInterval);

      w.addEventListener('beforeunload', function() {
        recordScrollBands(); // Capture final scroll depth
        if (hs.buffer.length === 0) return;
        navigator.sendBeacon(config.apiHost + '/api/v1/heatmaps/record',
          new Blob([JSON.stringify({ website_id: config.websiteId, points: hs.buffer })], { type: 'application/json' }));
        hs.buffer = [];
      });

      d.addEventListener('visibilitychange', function() {
        if (d.visibilityState === 'hidden') flushBuffer();
      });

      // SPA navigation
      var origPush = history.pushState, origReplace = history.replaceState;
      var handleNav = function() {
        var cp = normalizePath(w.location.pathname);
        if (cp !== normalizePath(new URL(hs.lastUrl).pathname)) {
          flushBuffer();
          hs.lastUrl = w.location.href;
          if (maxHeatmaps > 0) {
            hs.enabled = trackedUrls.includes(cp) || trackedUrls.length < maxHeatmaps;
          }
          if (hs.enabled) {
            if (!trackedUrls.includes(cp)) trackedUrls.push(cp);
            addPoint('pageview', 0, 0);
          }
        }
      };
      history.pushState = function() { origPush.apply(this, arguments); handleNav(); };
      history.replaceState = function() { origReplace.apply(this, arguments); handleNav(); };
      w.addEventListener('popstate', handleNav);
    }
  }
})(window, document);
