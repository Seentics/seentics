/*!
 * Seentics tracker — replay extension: console, network and error capture for recordings.
 *
 * Loaded by the core only for a visitor whose session is being recorded, alongside the
 * DOM recorder itself (seentics-dom.min.js). Nothing here is installed — no console
 * override, no fetch wrapper — for anyone else.
 */
import { registerExtension } from './ext-register.js';

registerExtension((core) => {
  const { COLLECT } = core;

  /** Queue one sidecar event onto the recording, while this session is being captured. */
  const enqueue = (type, data, ts = Date.now()) => {
    if (!core.captureActive) return;
    core.queues.session.push({
      type,
      data,
      ts,
      url: location.href,
      sid: core.getSessionId(),
      vid: core.visitorId,
    });
  };

  // ─── Redaction ─────────────────────────────────────────────────────────────────

  /**
   * Query keys whose values never leave the browser intact.
   *
   * Recordings are replayed by whoever can see the dashboard, so a password-reset link or
   * a bearer token in a request URL becomes a durable credential sitting in storage. The
   * match is a substring, case-insensitive, so `X-Api-Key`, `access_token` and
   * `resetPasswordCode` are all covered by the short list below.
   */
  const SENSITIVE_KEY_RE =
    /(pass|pwd|secret|token|auth|bearer|session|sid|api[-_]?key|signature|\bsig\b|credential|otp|code|email|phone|ssn)/i;

  const REDACTED = '[redacted]';
  /** URL-safe, so a scrubbed query parameter reads as `?token=redacted`, not `%5B…%5D`. */
  const REDACTED_PARAM = 'redacted';

  /** Anything shaped like an address or a long opaque credential, wherever it appears. */
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
  const LONG_OPAQUE_RE = /\b[A-Za-z0-9_-]{40,}\b/g;

  /** Scrub free text — console arguments, error messages, stack frames. */
  const redactText = (text) => {
    if (typeof text !== 'string' || !text) return text;
    return text
      .replace(JWT_RE, REDACTED)
      .replace(EMAIL_RE, REDACTED)
      .replace(LONG_OPAQUE_RE, REDACTED);
  };

  /**
   * A URL safe to store: no credentials, no fragment, sensitive query values replaced.
   *
   * Keys are kept because "which parameter" is most of the debugging value and the key
   * itself is rarely the secret. Non-sensitive values are kept but scrubbed for addresses
   * and token-shaped strings, since a `?next=` or `?q=` routinely carries both.
   */
  const redactUrl = (raw) => {
    if (typeof raw !== 'string' || !raw) return '';
    let u;
    try {
      u = new URL(raw, location.href);
    } catch {
      // Not parseable (a relative path on a page with an odd base, say) — scrub as text.
      return redactText(raw).slice(0, 1000);
    }
    // `https://user:pass@host` — never worth keeping.
    u.username = '';
    u.password = '';
    // Fragments are client-only and disproportionately carry tokens (implicit OAuth flows).
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (SENSITIVE_KEY_RE.test(key)) {
        u.searchParams.set(key, REDACTED_PARAM);
      } else {
        const value = u.searchParams.get(key);
        const scrubbed = redactText(value);
        if (scrubbed !== value) u.searchParams.set(key, scrubbed);
      }
    }
    return u.toString().slice(0, 1000);
  };

  // ─── Errors ────────────────────────────────────────────────────────────────────

  /**
   * Window errors and unhandled rejections as annotations in the replay timeline.
   * Messages and stacks routinely quote the value that broke and the URL it came from,
   * so both go through the same scrub as everything else stored in a recording.
   */
  const installErrorCapture = () => {
    if (window.__snc_err_cap) return;
    window.__snc_err_cap = true;

    window.addEventListener('error', (ev) => {
      enqueue('session_error', {
        message:  redactText(ev.message) || 'Script error',
        filename: ev.filename ? redactUrl(ev.filename) : undefined,
        lineno:   ev.lineno   || undefined,
        colno:    ev.colno    || undefined,
        stack:    ev.error?.stack ? redactText(ev.error.stack) : undefined,
      });
    }, true);

    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev.reason;
      const isErr  = reason instanceof Error;
      enqueue('session_error', {
        message: redactText(isErr ? reason.message : String(reason ?? 'Unhandled rejection')),
        stack:   isErr && reason.stack ? redactText(reason.stack) : undefined,
      });
    });
  };

  // ─── Console ───────────────────────────────────────────────────────────────────

  /**
   * Override console methods so log entries appear in the replay DevTools panel.
   * Originals are still called unchanged.
   */
  const installConsoleCapture = () => {
    if (window.__snc_con_cap) return;
    window.__snc_con_cap = true;

    // Caps keep console capture cheap even when the host app logs large objects
    // in tight loops (serializing multi-MB objects on every log call is a real
    // main-thread cost, and oversized args bloat every /collect payload).
    const MAX_CONSOLE_ARGS    = 10;
    const MAX_CONSOLE_ARG_LEN = 1_000;

    const enqueueConsole = (level, args) => {
      if (!core.captureActive) return;
      const serialized = args.slice(0, MAX_CONSOLE_ARGS).map(a => {
        let s;
        if (typeof a === 'string') s = a;
        else { try { s = JSON.stringify(a); } catch { s = String(a); } }
        s = String(s ?? '');
        // Applications log user objects, API responses and auth headers as a matter of
        // course. Whatever the reason, none of it should become a durable recording.
        s = redactText(s);
        return s.length > MAX_CONSOLE_ARG_LEN ? s.slice(0, MAX_CONSOLE_ARG_LEN) + '…' : s;
      });
      enqueue('console_event', { level, args: serialized });
    };

    ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
      const orig = console[level];
      console[level] = function() {
        orig.apply(console, arguments);
        try { enqueueConsole(level, Array.prototype.slice.call(arguments)); } catch { /* ignore */ }
      };
    });
  };

  // ─── Network ───────────────────────────────────────────────────────────────────

  /**
   * Intercept fetch and XHR to record network requests as session events.
   * Excludes the tracker's own /collect calls to avoid infinite event loops.
   */
  const installNetworkCapture = () => {
    if (window.__snc_net_cap) return;
    window.__snc_net_cap = true;

    // Scrubbed here rather than at each call site, so a new one cannot forget: request
    // URLs carry reset keys, one-time codes and bearer tokens as query parameters.
    const enqueueNetwork = (data) => {
      enqueue('network_event', { ...data, url: redactUrl(data.url), error: redactText(data.error) }, data.startTs);
    };
    const isOwn = (url) => url === COLLECT || url.startsWith(COLLECT + '?');

    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      const method  = ((init && init.method) || 'GET').toUpperCase();
      const reqUrl  = typeof input === 'string' ? input
        : (input instanceof URL ? input.href : (input && typeof input.url === 'string' ? input.url : ''));
      if (!reqUrl || isOwn(reqUrl)) return origFetch.apply(this, arguments);
      const startTs = Date.now();
      const p = origFetch.apply(this, arguments);
      // Observe on a side chain WITHOUT rethrowing: rethrowing here would surface a
      // second, unhandled rejection for every failed fetch the page itself handles.
      p.then(
        function(response) {
          try { enqueueNetwork({ method, url: reqUrl, status: response.status, duration: Date.now() - startTs, startTs }); } catch { /* ignore */ }
        },
        function(err) {
          try { enqueueNetwork({ method, url: reqUrl, status: 0, duration: Date.now() - startTs, startTs, error: String(err) }); } catch { /* ignore */ }
        }
      );
      return p;
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._snc_method = String(method || 'GET');
      this._snc_url    = String(url || '');
      this._snc_start  = 0;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
      const req = this;
      if (req._snc_url && !isOwn(req._snc_url)) {
        req._snc_start = Date.now();
        req.addEventListener('loadend', function() {
          try {
            enqueueNetwork({
              method:   (req._snc_method || 'GET').toUpperCase(),
              url:      req._snc_url,
              status:   req.status,
              duration: Date.now() - req._snc_start,
              startTs:  req._snc_start,
            });
          } catch { /* ignore */ }
        });
      }
      return origSend.apply(this, arguments);
    };
  };

  return {
    /**
     * `data-capture-console="off"` / `data-capture-network="off"` on the script tag mean
     * the patch is never installed, not merely that events are discarded: the override
     * itself is observable to the host page (it changes the source line DevTools
     * attributes every log to), so "disabled" has to mean absent.
     */
    install({ console: captureConsole, network: captureNetwork }) {
      if (captureConsole) installConsoleCapture();
      if (captureNetwork) installNetworkCapture();
      installErrorCapture();
    },
  };
});
