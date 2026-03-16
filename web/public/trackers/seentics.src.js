(function (window, document) {
    'use strict';

    const script = document.currentScript;
    const siteId = script.getAttribute('data-website-id');
    const apiHost = script.getAttribute('data-api-host') || 'https://api.seentics.com';
    const autoTrack = script.getAttribute('data-auto-track') !== 'false';
    const domain = window.location.hostname;

    let config = {};
    let funnels = [];
    let eventQueue = [];
    let flushTimeout = null;

    // --- Session & Visitor Handling (Privacy First, No Cookies) ---
    const getStorage = () => {
        try { return window.localStorage; } catch (e) { return null; }
    };

    const getVisitorId = () => {
        const storage = getStorage();
        if (!storage) return 'id-' + Math.random().toString(36).substr(2, 9);
        let id = storage.getItem('seentics_v_id');
        if (!id) {
            id = 'v-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            storage.setItem('seentics_v_id', id);
        }
        return id;
    };

    const getSessionId = () => {
        const storage = getStorage();
        if (!storage) return 's-' + Date.now();
        let id = storage.getItem('seentics_s_id');
        let expiry = storage.getItem('seentics_s_exp');
        
        if (!id || !expiry || Date.now() > parseInt(expiry)) {
            id = 's-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            storage.setItem('seentics_s_id', id);
        }
        // Refresh session expiry (30 mins of inactivity)
        storage.setItem('seentics_s_exp', (Date.now() + 30 * 60 * 1000).toString());
        return id;
    };

    // --- Tracking Logic ---

    const track = (type, props) => {
        const event = {
            website_id: siteId,
            visitor_id: getVisitorId(),
            session_id: getSessionId(),
            event_type: type || 'pageview',
            page: window.location.href,
            referrer: document.referrer || '',
            language: navigator.language || '',
            screen_width: window.innerWidth,
            screen_height: window.innerHeight,
            properties: props || {},
            timestamp: new Date().toISOString()
        };

        eventQueue.push(event);
        
        if (!flushTimeout) {
            flushTimeout = setTimeout(flush, 2000);
        }
    };

    const flush = () => {
        if (eventQueue.length === 0) return;

        const payload = JSON.stringify({
            site_id: siteId,
            domain: domain,
            events: eventQueue
        });

        const url = apiHost + '/api/v1/tracker/collect';

        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, payload);
        } else {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(payload);
        }

        eventQueue = [];
        flushTimeout = null;
    };

    // --- Initialization ---

    const init = () => {
        if (!siteId) return;

        // Fetch config & funnels
        fetch(`${apiHost}/api/v1/tracker/init/${siteId}`)
            .then(res => res.json())
            .then(data => {
                config = data.config || {};
                funnels = data.funnels || [];
                
                if (autoTrack) {
                    track('pageview');
                }
            })
            .catch(() => {
                // Fail-safe: if init fails, still track if autoTrack is on
                if (autoTrack) track('pageview');
            });

        // SPA Support
        let lastPath = window.location.pathname;
        const checkPathChange = () => {
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                track('pageview');
            }
        };

        window.addEventListener('popstate', checkPathChange);
        
        const originalPushState = window.history.pushState;
        if (originalPushState) {
            window.history.pushState = function(...args) {
                originalPushState.apply(this, args);
                checkPathChange();
            };
        }

        const originalReplaceState = window.history.replaceState;
        if (originalReplaceState) {
            window.history.replaceState = function(...args) {
                originalReplaceState.apply(this, args);
                checkPathChange();
            };
        }

        // Flush on exit
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush();
        });
    };

    // Expose global object
    window.seentics = {
        track: track,
        identify: (id) => {
            const storage = getStorage();
            if (storage) storage.setItem('seentics_v_id', id);
        }
    };

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})(window, document);
