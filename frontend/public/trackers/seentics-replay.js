/**
 * Seentics Replay Tracker
 * Captures DOM mutations and interactions for session replay
 */

(function(w, d) {
  'use strict';

  // Wait for Core to be ready
  if (!w.SEENTICS_CORE) {
    const checkCore = setInterval(() => {
      if (w.SEENTICS_CORE) {
        clearInterval(checkCore);
        initReplay();
      }
    }, 100);
    return;
  }

  initReplay();

  async function initReplay() {
    const core = w.SEENTICS_CORE;
    const config = core.config;
    const state = core.state;

    // Replay specific configuration
    const replayConfig = {
      rrwebUrl: 'https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb.min.js',
      chunkSize: 1000, // Send every 1000 events
      flushInterval: 30000 // Every 30 seconds
    };

    // Replay state
    const replayState = {
      buffer: [],
      sequence: 0,
      isRecording: false,
      isSending: false,
      stopFn: null,
      lastFlush: Date.now()
    };

    /**
     * Load rrweb dynamically from CDN
     */
    const loadRRWeb = () => {
      return new Promise((resolve, reject) => {
        if (w.rrweb) return resolve();
        
        const script = d.createElement('script');
        script.src = replayConfig.rrwebUrl;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        d.head.appendChild(script);
      });
    };

    /**
     * Send chunk to backend
     */
    const sendChunk = async (isManual = false) => {
      // Don't send if empty or already sending
      if (replayState.buffer.length === 0 || replayState.isSending) return;
      
      // If it's a periodic flush, check conditions
      if (!isManual) {
          const timeSinceFlush = Date.now() - replayState.lastFlush;
          
          // Data is too fresh (e.g. sent via chunk limit recently)
          if (timeSinceFlush < replayConfig.flushInterval / 2) {
              return;
          }

          // Buffer is small and we haven't waited long enough (adaptive batching)
          // If we have < 10 events, wait up to 60s before forcing flush
          if (replayState.buffer.length < 10 && timeSinceFlush < 60000) {
              return;
          }
      }

      replayState.isSending = true;
      const events = [...replayState.buffer];
      const sequence = replayState.sequence++;
      replayState.buffer = [];
      replayState.lastFlush = Date.now();

      try {
        await core.api.send('replays/record', {
            website_id: config.websiteId,
            session_id: state.sessionId,
            events: events,
            sequence: sequence
        });
      } catch (err) {
        if (config.debug) {
          console.error('[Seentics Replay] Failed to send chunk', err);
        }
        // Restore buffer on failure to retry (limit retry depth)
        if (replayState.buffer.length < 2000) {
            replayState.buffer = [...events, ...replayState.buffer];
            replayState.sequence--;
        }
      } finally {
        replayState.isSending = false;
      }
    };

    try {
      await loadRRWeb();
      
      if (!w.rrweb) {
        throw new Error('rrweb failed to load');
      }

      // Start recording
      replayState.stopFn = w.rrweb.record({
        emit(event) {
          replayState.buffer.push(event);
          if (replayState.buffer.length >= replayConfig.chunkSize) {
            sendChunk(true);
          }
        },
        // Privacy: Mask sensitive fields by default
        maskAllInputs: true,
        maskInputOptions: {
            password: true,
            email: true
        }
      });

      replayState.isRecording = true;

      // Periodic flush
      setInterval(sendChunk, replayConfig.flushInterval);

      // Flush on page leave
      w.addEventListener('beforeunload', () => {
        if (replayState.buffer.length > 0) {
          sendChunk();
        }
      });

      if (config.debug) {
        console.log('[Seentics Replay] Initialized');
      }
    } catch (err) {
      if (config.debug) {
        console.warn('[Seentics Replay] Failed to initialize:', err);
      }
    }
  }

})(window, document);
