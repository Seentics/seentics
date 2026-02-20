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

    // Sampling: replay_sampling_rate is 0.0-1.0 (fraction). Default 1.0 = record all sessions.
    // FORCE 1.0 for now to guarantee recording during debugging
    const samplingRate = 1.0; 

    // Detect base path from current script source
    let basePath = '/trackers/';
    const script = d.currentScript;
    if (script && script.src) {
      basePath = script.src.substring(0, script.src.lastIndexOf('/') + 1);
    }

    // Replay specific configuration
    const replayConfig = {
      // Use local version for reliability
      rrwebUrl: `${basePath}rrweb.min.js`,
      rrwebFallbackUrl: 'https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.18/dist/rrweb.umd.js',
      chunkSize: 500, // Smaller chunks for better sync
      flushInterval: 10000 // 10s flush for better sync
    };

    // Replay state - persistent sequence across page loads
    const initialSequence = parseInt(sessionStorage.getItem('seentics_replay_seq') || '0');
    const replayState = {
      buffer: [],
      sequence: initialSequence,
      isRecording: false,
      isSending: false,
      stopFn: null,
      lastFlush: Date.now()
    };

    /**
     * Load rrweb dynamically
     */
    const loadRRWeb = async () => {
      if (w.rrweb) return;
      
      const tryLoad = (url) => {
        return new Promise((resolve, reject) => {
          const script = d.createElement('script');
          script.src = url;
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          d.head.appendChild(script);
        });
      };

      try {
        if (config.debug) console.log(`[Seentics Replay] Loading local rrweb from ${replayConfig.rrwebUrl}`);
        await tryLoad(replayConfig.rrwebUrl);
      } catch (err) {
        console.warn(`[Seentics Replay] Local rrweb failed, trying CDN...`, err);
        await tryLoad(replayConfig.rrwebFallbackUrl);
      }
    };

    /**
     * Send chunk to backend
     */
    const sendChunk = async (isManual = false) => {
      // Don't send if empty or already sending
      if (replayState.buffer.length === 0 || replayState.isSending) return;

      replayState.isSending = true;
      const events = [...replayState.buffer];
      const sequence = replayState.sequence++;
      
      // Update persistent sequence
      sessionStorage.setItem('seentics_replay_seq', replayState.sequence.toString());
      
      replayState.buffer = [];
      replayState.lastFlush = Date.now();

      try {
        await core.api.send('replays/record', {
            website_id: config.websiteId,
            session_id: state.sessionId,
            events: events,
            sequence: sequence,
            page: w.location.pathname
        });
      } catch (err) {
        if (config.debug) {
          console.error('[Seentics Replay] Failed to send chunk', err);
        }

        // If it's a 400 error, it's a permanent schema mismatch or invalid data
        // Stop retrying and clear buffer to avoid infinite loop
        if (err.message && err.message.includes('400')) {
             if (config.debug) {
                 console.warn('[Seentics Replay] Permanent 400 error, stopping retries for this chunk');
             }
             return;
        }

        // Restore buffer on other failures to retry (limit retry depth)
        if (replayState.buffer.length < 2000) {
            replayState.buffer = [...events, ...replayState.buffer];
            replayState.sequence--;
        }
      } finally {
        replayState.isSending = false;
      }
    };

    try {
      console.log(`[Seentics Replay] Initializing... (Sampling Rate: ${samplingRate * 100}%)`);
      
      // Sampling check
      if (Math.random() > samplingRate) {
        console.warn(`[Seentics Replay] Session skipped by sampling rate (${samplingRate * 100}%).`);
        return;
      }

      if (config.debug) console.log('[Seentics Replay] Loading rrweb...');
      await loadRRWeb();
      
      if (!w.rrweb) {
        console.error('[Seentics Replay] rrweb failed to load or define global object');
        return;
      }

      if (config.debug) console.log('[Seentics Replay] rrweb loaded, starting record');

      // Start recording
      replayState.stopFn = w.rrweb.record({
        emit(event) {
          replayState.buffer.push(event);
          
          if (config.debug && replayState.buffer.length % 50 === 0) {
              console.log(`[Seentics Replay] Buffered ${replayState.buffer.length} events`);
          }

          // Force flush the first few events (full snapshot is usually the first event)
          if (replayState.sequence === 0 && replayState.buffer.length >= 2) {
              if (config.debug) console.log('[Seentics Replay] Forcing initial chunk flush');
              sendChunk(true);
          }

          if (replayState.buffer.length >= replayConfig.chunkSize) {
            sendChunk(true);
          }
        },
        maskAllInputs: true,
        maskInputOptions: {
            password: true,
            email: true
        }
      });

      if (!replayState.stopFn) {
        throw new Error('rrweb.record failed to initialize result stopFn');
      }

      replayState.isRecording = true;
      console.table({
        '[Seentics Replay] Status': 'Active',
        'Website ID': config.websiteId,
        'Session ID': state.sessionId,
        'API Host': config.apiHost
      });

      // Periodic flush
      setInterval(sendChunk, replayConfig.flushInterval);

      // Flush remaining events on page leave using sendBeacon
      w.addEventListener('beforeunload', () => {
        if (replayState.buffer.length === 0) return;
        if (config.debug) console.log('[Seentics Replay] Page leave: flushing buffer');
        const payload = JSON.stringify({
          website_id: config.websiteId,
          session_id: state.sessionId,
          events: replayState.buffer,
          sequence: replayState.sequence++,
          page: w.location.pathname
        });
        navigator.sendBeacon(
          `${config.apiHost}/api/v1/replays/record`,
          new Blob([payload], { type: 'application/json' })
        );
        replayState.buffer = [];
      });

      // Flush when tab becomes hidden
      d.addEventListener('visibilitychange', () => {
        if (d.visibilityState === 'hidden') {
            if (config.debug) console.log('[Seentics Replay] Visibility hidden: flushing buffer');
            sendChunk(true);
        }
      });

    } catch (err) {
      console.error('[Seentics Replay] Failed to initialize:', err);
    }
  }

})(window, document);
