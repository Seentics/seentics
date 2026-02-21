/**
 * Seentics Replay Tracker
 * Captures DOM mutations and interactions for session replay
 */
(function(w, d) {
  'use strict';
  if (!w.SEENTICS_CORE) {
    var check = setInterval(function() {
      if (w.SEENTICS_CORE) { clearInterval(check); initReplay(); }
    }, 100);
    return;
  }
  initReplay();

  function initReplay() {
    var core = w.SEENTICS_CORE, config = core.config, state = core.state;

    // Configurable sampling rate (0.0-1.0), default 10%
    var samplingRate = (typeof config.replay_sampling_rate === 'number' && config.replay_sampling_rate > 0)
      ? config.replay_sampling_rate : 0.1;

    // Detect base path from script source
    var basePath = '/trackers/';
    var script = d.currentScript;
    if (script && script.src) basePath = script.src.substring(0, script.src.lastIndexOf('/') + 1);

    var chunkSize = 500, flushInterval = 10000;
    var rrwebUrl = basePath + 'rrweb.min.js';
    var rrwebFallback = 'https://cdn.jsdelivr.net/npm/rrweb@2.0.0-alpha.18/dist/rrweb.umd.js';

    var initialSeq = parseInt(sessionStorage.getItem('seentics_replay_seq') || '0');
    var rs = {
      buffer: [], sequence: initialSeq, isRecording: false,
      isSending: false, stopFn: null, lastFlush: Date.now()
    };

    var loadRRWeb = function() {
      if (w.rrweb) return Promise.resolve();
      var tryLoad = function(url) {
        return new Promise(function(resolve, reject) {
          var s = d.createElement('script');
          s.src = url; s.async = true;
          s.onload = resolve; s.onerror = reject;
          d.head.appendChild(s);
        });
      };
      return tryLoad(rrwebUrl).catch(function() { return tryLoad(rrwebFallback); });
    };

    var sendChunk = function() {
      if (rs.buffer.length === 0 || rs.isSending) return Promise.resolve();
      rs.isSending = true;
      var events = rs.buffer.slice();
      var seq = rs.sequence++;
      sessionStorage.setItem('seentics_replay_seq', rs.sequence.toString());
      rs.buffer = [];
      rs.lastFlush = Date.now();

      return core.api.send('replays/record', {
        website_id: config.websiteId, session_id: state.sessionId,
        events: events, sequence: seq, page: w.location.pathname
      }).catch(function(err) {
        if (err.message && err.message.includes('400')) return; // Permanent error
        if (rs.buffer.length < 2000) {
          rs.buffer = events.concat(rs.buffer);
          rs.sequence--;
        }
      }).finally(function() { rs.isSending = false; });
    };

    // Sampling check
    if (Math.random() > samplingRate) return;

    loadRRWeb().then(function() {
      if (!w.rrweb) { console.error('[Seentics Replay] rrweb failed to load'); return; }

      rs.stopFn = w.rrweb.record({
        emit: function(event) {
          rs.buffer.push(event);
          if (rs.sequence === initialSeq && rs.buffer.length >= 2) sendChunk();
          if (rs.buffer.length >= chunkSize) sendChunk();
        },
        maskAllInputs: true,
        maskInputOptions: { password: true, email: true }
      });

      if (!rs.stopFn) return;
      rs.isRecording = true;

      setInterval(sendChunk, flushInterval);

      w.addEventListener('beforeunload', function() {
        if (rs.buffer.length === 0) return;
        navigator.sendBeacon(config.apiHost + '/api/v1/replays/record',
          new Blob([JSON.stringify({
            website_id: config.websiteId, session_id: state.sessionId,
            events: rs.buffer, sequence: rs.sequence++, page: w.location.pathname
          })], { type: 'application/json' }));
        rs.buffer = [];
      });

      d.addEventListener('visibilitychange', function() {
        if (d.visibilityState === 'hidden') sendChunk();
      });
    }).catch(function(err) {
      console.error('[Seentics Replay] Init failed:', err);
    });
  }
})(window, document);
