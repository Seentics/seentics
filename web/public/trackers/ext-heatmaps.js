/*!
 * Seentics tracker — heatmap extension: click and scroll capture, layout snapshots.
 *
 * Loaded by the core (seentics.js) only when heatmaps are on for the site, so a visitor
 * on a site without them never downloads or parses any of this. See `loadExt` there.
 */
import { registerExtension } from './ext-register.js';

const TRACKER_VERSION = '2.2.0';
const HEATMAP_SCHEMA_VERSION = 2;
const HEATMAP_QUEUE_MAX = 2_000;

/**
 * Largest serialized DOM snapshot the tracker will send.
 *
 * 3 MB of HTML gzips to a few hundred KB, so this sits far inside the collect
 * endpoint's 8 MB compressed / 50 MB expanded transport limits. It must stay below
 * the schema's own 3.5 MB ceiling: over that the server rejects the entire batch,
 * losing the pageviews and clicks travelling with the snapshot.
 */
const MAX_DOM_SNAPSHOT_BYTES = 3_000_000;

/**
 * rrweb internal numeric constants used in `mirror`.
 * Source: https://github.com/rrweb-io/rrweb/blob/master/packages/types/src/index.ts
 */
const RRWEB_INCREMENTAL_SNAPSHOT = 3;
const RRWEB_SOURCE_MOUSE_INTERACTION = 2;
const RRWEB_SOURCE_SCROLL = 3;
const RRWEB_MOUSE_CLICK = 2;

registerExtension((core) => {
  const { websiteId, queues } = core;
  const cfg = () => core.cfg;
  const layoutEnabled = () => cfg().heatmap_layout_enabled !== false;

  /**
   * Heatmap capture is on and the current URL passes the include/exclude rules.
   *
   * Memoised per URL: it runs on every click and scroll, and evaluating the rules means
   * splitting the pattern lists and compiling each line as a regex.
   */
  let allowedFor = '';
  let allowedValue = false;
  const heatmapAllowed = () => {
    // A page the site's policy does not track (strict mode without consent, Do Not
    // Track): this extension is still loaded, but records nothing. Clicks and scrolls are
    // anonymous, so a visitor who has not consented contributes them too.
    if (cfg().heatmap_enabled === false || !core.heatmapsAllowed) return false;
    if (allowedFor !== location.href) {
      allowedFor = location.href;
      allowedValue = core.urlAllowed(cfg().heatmap_include_patterns, cfg().heatmap_exclude_patterns);
    }
    return allowedValue;
  };

  // ─── Layout snapshot dedup ─────────────────────────────────────────────────────

  /**
   * Per-tab, per-path dedup key stored in sessionStorage. Once a snapshot is queued for
   * a path, another is not sent until the visitor opens a new tab (or the page grows).
   */
  const snapshotSentKey = () => `snc_hmshot:${websiteId}:${location.pathname}`;

  const hasSentSnapshotForPath = () => {
    try { return sessionStorage.getItem(snapshotSentKey()) === '1'; }
    catch { return false; }
  };

  const markSnapshotSentForPath = () => {
    try { sessionStorage.setItem(snapshotSentKey(), '1'); }
    catch { /* ignore */ }
  };

  /**
   * How long a page must have been on screen before an unload-time capture is worth
   * storing. Below this the document is still assembling and the snapshot would depict a
   * layout no visitor saw — worse than having none, because the points would be drawn on it.
   */
  const MIN_DWELL_FOR_LEAVE_SNAPSHOT_MS = 800;

  /** Timeouts queued after load/navigation to let the page fully render first. */
  let snapshotTimers = [];

  const clearSnapshotTimers = () => {
    for (const id of snapshotTimers) window.clearTimeout(id);
    snapshotTimers = [];
  };

  /**
   * Capture the layout once the page has rendered: 2.5 s after the load event (or after a
   * SPA navigation). The core now starts as soon as the document is parsed rather than at
   * `load`, so on a first page view this waits for `load` itself — a capture taken while
   * images are still arriving records a layout whose heights are still changing.
   */
  const scheduleSnapshot = () => {
    // The snapshot waits for consent where it is asked (see captureAndQueueDomSnapshot).
    if (!layoutEnabled() || !heatmapAllowed() || !core.identified) return;
    clearSnapshotTimers();
    const later = () => snapshotTimers.push(window.setTimeout(captureAndQueueDomSnapshot, 2_500));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
  };

  /**
   * Last chance to capture the layout: the visitor is leaving and the scheduled
   * post-render capture has not run.
   *
   * Without this a page nobody lingers on never gets a background, and its heatmap shows
   * points over nothing — the common case being an app route people click straight
   * through. The dwell floor keeps a half-rendered document out of storage, and the
   * per-path session marker means this costs one serialization per path at most.
   */
  const captureBeforeLeaving = () => {
    if (!layoutEnabled()) return;
    if (hasSentSnapshotForPath()) {
      if (pageGrewSinceSnapshot()) captureAndQueueDomSnapshot({ force: true });
      return;
    }
    if (Date.now() - core.pageEnterMs < MIN_DWELL_FOR_LEAVE_SNAPSHOT_MS) return;
    clearSnapshotTimers();
    captureAndQueueDomSnapshot();
  };

  /**
   * Pages that grow as they are read — infinite feeds, "load more" grids, expanding lists.
   *
   * The snapshot is taken 2.5 s after load, when such a page is a fraction of the height
   * it reaches, and it used to be the only one per path per session: every click further
   * down was stored with the right coordinates and then drawn below the bottom of the
   * picture. When the document has grown well past the height it had at the last capture,
   * it is captured again — after a pause in scrolling so the new content has rendered, and
   * a bounded number of times per page view.
   */
  const SNAPSHOT_GROWTH_RATIO = 1.5;
  const SNAPSHOT_GROWTH_MIN_PX = 1_000;
  const SNAPSHOT_RECAPTURES_MAX = 3;
  let lastSnapshot = { path: '', height: 0, recaptures: 0 };
  let growthRecaptureTimer = null;

  const pageGrewSinceSnapshot = () => {
    if (lastSnapshot.path !== location.pathname || !lastSnapshot.height) return false;
    if (lastSnapshot.recaptures >= SNAPSHOT_RECAPTURES_MAX) return false;
    const { dh } = documentMetrics();
    return dh >= Math.max(lastSnapshot.height * SNAPSHOT_GROWTH_RATIO, lastSnapshot.height + SNAPSHOT_GROWTH_MIN_PX);
  };

  /** Called on scroll: re-capture once the page has grown and scrolling has paused. */
  const scheduleGrowthRecapture = () => {
    if (!layoutEnabled() || growthRecaptureTimer != null) return;
    if (!pageGrewSinceSnapshot()) return;
    growthRecaptureTimer = window.setTimeout(() => {
      growthRecaptureTimer = null;
      if (pageGrewSinceSnapshot()) captureAndQueueDomSnapshot({ force: true });
    }, 1_500);
  };

  /**
   * Copy each open shadow root under `live` into the matching element under `copy` as a
   * `<template shadowrootmode="open">`, recursively, collecting the templates' contents.
   * `copy` is a fresh clone of `live`, so both trees list their elements in the same order.
   * Stylesheets adopted by a shadow root are written in as <style> — they are otherwise
   * invisible to serialization, and components that style themselves that way would
   * arrive unstyled.
   */
  const attachShadowTemplates = (live, copy, contents) => {
    const liveEls = live.querySelectorAll('*');
    const copyEls = copy.querySelectorAll('*');
    if (liveEls.length !== copyEls.length) return;
    for (let i = 0; i < liveEls.length; i++) {
      const shadow = liveEls[i].shadowRoot;
      if (!shadow) continue;
      const tpl = document.createElement('template');
      tpl.setAttribute('shadowrootmode', 'open');
      for (const child of shadow.childNodes) tpl.content.appendChild(child.cloneNode(true));
      // Nested roots first: they are paired by element order, which the <style> added
      // below would shift.
      attachShadowTemplates(shadow, tpl.content, contents);
      try {
        for (const sheet of shadow.adoptedStyleSheets || []) {
          const style = document.createElement('style');
          style.textContent = Array.from(sheet.cssRules, rule => rule.cssText).join('\n');
          tpl.content.prepend(style);
        }
      } catch { /* cross-origin sheet */ }
      contents.push(tpl.content);
      copyEls[i].prepend(tpl);
    }
  };

  /**
   * Capture the current page as a DOM snapshot (serialized HTML) and queue it.
   *
   * Approach (Hotjar/Clarity style):
   * - Clone the live DOM so we don't mutate the page
   * - Insert <base href> so relative asset URLs resolve correctly when rendered
   * - Remove <script> tags so the snapshot is inert and safe to render in a sandboxed iframe
   * - Remove <iframe> to avoid cross-origin complications
   * - Runs once per path per session — deduped via sessionStorage
   */
  const captureAndQueueDomSnapshot = ({ force = false } = {}) => {
    // What this visitor saw: only with consent where it is asked (also keeps the
    // sessionStorage marker below out of an anonymous visitor's browser).
    if (!layoutEnabled() || !heatmapAllowed() || !core.identified) return;
    if (!force && hasSentSnapshotForPath()) return;
    try {
      const clone = document.documentElement.cloneNode(true);
      // cloneNode never copies shadow roots, so every web component used to arrive empty:
      // the background had a hole where the component was, and clicks inside it had no
      // element to land on. Open shadow roots are written in as declarative shadow DOM,
      // which the preview iframe's parser attaches again. Everything below that sanitizes
      // the clone goes through `qsa`, so it reaches inside those templates too.
      const shadowContents = [];
      attachShadowTemplates(document.documentElement, clone, shadowContents);
      const roots = [clone, ...shadowContents];
      const qsa = (selector) => roots.flatMap(root => Array.from(root.querySelectorAll(selector)));

      // Insert <base href> so relative URLs resolve against the original origin
      const head = clone.querySelector('head');
      if (head && !head.querySelector('base')) {
        const base = document.createElement('base');
        base.href = location.origin + '/';
        head.insertBefore(base, head.firstChild);
      }

      // Remove elements that are unsafe or unnecessary in a static snapshot
      qsa('script, noscript').forEach(el => el.remove());
      // Heatmap snapshots are durable objects, not just a visual preview. Apply the
      // same explicit privacy controls used by replay before serialising the clone:
      // blocked regions retain a harmless placeholder so the page geometry remains
      // useful for coordinate alignment, while masked regions retain only a fixed
      // redaction marker. Never rely on CSS visibility here — hidden text is still
      // present in the uploaded HTML.
      qsa('[data-seentics-block], [data-private], [autocomplete="cc-number"]').forEach(el => {
        el.replaceChildren('[blocked]');
        el.setAttribute('aria-label', 'Blocked content');
      });
      qsa('[data-seentics-mask], [data-sensitive]').forEach(el => {
        el.replaceChildren('••••••');
        el.setAttribute('aria-label', 'Masked content');
      });
      // Form values can be prefilled by the site (for example, profile data) and
      // therefore appear in outerHTML even when the visitor never types. Snapshot
      // layout needs the controls, not their values, so redact every form control.
      qsa('input, textarea').forEach(el => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = '';
          el.setAttribute('value', '');
          if (el instanceof HTMLTextAreaElement) el.textContent = '';
        }
      });
      qsa('select').forEach(el => {
        el.selectedIndex = -1;
        el.querySelectorAll('option').forEach(option => {
          option.removeAttribute('selected');
          option.textContent = '••••••';
          option.setAttribute('value', '');
        });
      });
      qsa('[contenteditable]:not([contenteditable="false"])').forEach(el => {
        el.replaceChildren('••••••');
        el.setAttribute('aria-label', 'Masked editable content');
      });
      // A cloned DOM can still execute inline handlers, javascript: URLs, meta refreshes,
      // form submissions and embedded plugins once loaded in an iframe. Keep only the
      // inert layout representation. The one script appended below is Seentics-owned and
      // only reports dimensions / resolves element fingerprints to rectangles.
      qsa('meta[http-equiv="refresh"], object, embed').forEach(el => el.remove());
      qsa('*').forEach(el => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on') || name === 'srcdoc') el.removeAttribute(attr.name);
          if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) {
            if (/^\s*(?:javascript|data:text\/html):/i.test(attr.value)) {
              el.removeAttribute(attr.name);
            } else {
              try {
                const u = new URL(attr.value, location.href);
                for (const key of Array.from(u.searchParams.keys())) {
                  if (/token|auth|session|secret|signature|password|email|key/i.test(key)) {
                    u.searchParams.delete(key);
                  }
                }
                el.setAttribute(attr.name, u.toString());
              } catch { /* relative or non-URL attribute */ }
            }
          }
          if (/token|secret|password|email|account/i.test(name)) el.removeAttribute(attr.name);
        }
        if (el instanceof HTMLFormElement) {
          el.removeAttribute('action');
          el.setAttribute('inert', '');
        }
      });
      // Conservative PII backstop for gated pages. Explicit mask/block selectors remain
      // the preferred control because a person's name cannot be inferred safely.
      try {
        const sensitiveText = [];
        for (const root of roots) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const value = node.nodeValue || '';
            if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:\d[ -]?){9,16}\b/i.test(value)) sensitiveText.push(node);
          }
        }
        sensitiveText.forEach(node => { node.nodeValue = '••••••'; });
      } catch { /* TreeWalker unavailable */ }
      // A page the site masks in full (all text, or one its patterns match — an account
      // page, a checkout): every word replaced, its length kept so the layout the clicks
      // are drawn on stays the page's. Stylesheets are text nodes too, and are left alone.
      if (core.textMaskedHere()) {
        for (const root of roots) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (node.parentNode && node.parentNode.nodeName === 'STYLE') continue;
            if (node.nodeValue) node.nodeValue = node.nodeValue.replace(/\S/g, '•');
          }
        }
      }
      // Replace cross-origin iframes with a placeholder (same-origin iframes could be captured,
      // but the added complexity and payload size aren't worth it for a layout snapshot)
      qsa('iframe').forEach(el => {
        const ph = document.createElement('div');
        ph.style.cssText = 'background:#f3f4f6;border:1px dashed #d1d5db;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;';
        ph.setAttribute('data-snc-placeholder', 'iframe');
        ph.textContent = '[embedded content]';
        el.replaceWith(ph);
      });

      // Inject a measurement script so the preview iframe can report its actual rendered
      // height via postMessage (works cross-origin). The snapshot HTML is served from S3
      // (different origin), so the viewer cannot read scrollHeight via contentDocument.
      // It also places recorded clicks on their elements (`find`). Stable annotations win,
      // then the recorded structural path when it names exactly one matching element, and
      // only then the fuzzy tag/role/class score. Scoring first used to put every click on a
      // repeated component (a card grid, a list, an id-less link) onto its first instance.
      if (head) {
        const measureScript = document.createElement('script');
        measureScript.textContent = `(function(){
        function esc(v){return window.CSS&&CSS.escape?CSS.escape(String(v)):String(v).replace(/[^a-zA-Z0-9_-]/g,'\\\\$&')}
        function allDeep(root,out){var els=root.querySelectorAll?root.querySelectorAll('*'):[];for(var i=0;i<els.length;i++){out.push(els[i]);if(els[i].shadowRoot)allDeep(els[i].shadowRoot,out)}return out}
        function find(l){
          if(!l||typeof l!=='object')return null;
          if(l.seentics_id){var x=document.querySelector('[data-seentics-id="'+esc(l.seentics_id)+'"]');if(x)return x}
          if(l.id){var byId=document.getElementById(l.id);if(byId)return byId}
          if(l.test_id){var t=document.querySelector('[data-testid="'+esc(l.test_id)+'"]');if(t)return t}
          if(l.css_path&&!l.shadow_host_path){try{var ps=document.querySelectorAll(l.css_path),p=ps.length===1?ps[0]:null;if(p&&(!l.tag||p.tagName.toLowerCase()===l.tag)&&(!Array.isArray(l.classes)||l.classes.every(function(k){return !k||p.classList.contains(k)})))return p}catch(e){}}
          var nodes=allDeep(document,[]),best=null,bestScore=-1;
          for(var i=0;i<nodes.length;i++){
            var n=nodes[i],score=0;
            if(l.tag&&n.tagName&&n.tagName.toLowerCase()===l.tag)score+=2;else if(l.tag)continue;
            if(l.role&&n.getAttribute('role')===l.role)score+=4;
            if(l.aria_label&&n.getAttribute('aria-label')===l.aria_label)score+=5;
            if(Array.isArray(l.classes))for(var c=0;c<l.classes.length;c++)if(n.classList.contains(l.classes[c]))score++;
            if(typeof l.sibling_index==='number'&&n.parentElement&&Array.prototype.indexOf.call(n.parentElement.children,n)===l.sibling_index)score+=0.5;
            if(score>bestScore){best=n;bestScore=score}
          }
          if(best&&bestScore>=2)return best;
          return null;
        }
        function dims(){var h=Math.max(document.documentElement.scrollHeight||0,(document.body||{}).scrollHeight||0),w=Math.max(document.documentElement.scrollWidth||0,(document.body||{}).scrollWidth||0);try{window.parent.postMessage({type:'snc_snap_dims',w:w,h:h},'*')}catch(e){}}
        window.addEventListener('message',function(e){var d=e.data;if(!d||d.type!=='snc_map_points'||!Array.isArray(d.points))return;var mapped=[];for(var i=0;i<d.points.length;i++){var p=d.points[i],el=find(p.locator);if(!el)continue;var r=el.getBoundingClientRect(),rx=Number.isFinite(p.relativeX)?p.relativeX:.5,ry=Number.isFinite(p.relativeY)?p.relativeY:.5;mapped.push({index:p.index,x:r.left+window.scrollX+r.width*rx,y:r.top+window.scrollY+r.height*ry,method:(p.locator.seentics_id||p.locator.id||p.locator.test_id)?'element':'fingerprint'})}try{window.parent.postMessage({type:'snc_mapped_points',requestId:d.requestId,mapped:mapped},'*')}catch(err){}});
        if(document.readyState==='complete')dims();else window.addEventListener('load',dims);
      })();`;
        head.appendChild(measureScript);
      }

      const html = '<!DOCTYPE html>' + clone.outerHTML;

      // Oversized snapshots are dropped rather than sent: the collect schema rejects the
      // *whole* batch when one field is over its limit, so an outsized snapshot would take
      // that flush's pageviews and clicks down with it. This ceiling stays below the
      // server's (3.5 MB) so it is always this check that bites, never the 400.
      //
      // The warning matters as much as the limit. A heavy app shell can exceed the cap on
      // every page, and the only symptom is a heatmap that never gets a background — there
      // is nothing server-side to look at, because nothing was ever sent.
      if (html.length > MAX_DOM_SNAPSHOT_BYTES) {
        console.warn(
          '[Seentics] heatmap DOM snapshot skipped: page is ' +
          Math.round(html.length / 1024) + ' KB, over the ' +
          Math.round(MAX_DOM_SNAPSHOT_BYTES / 1024) + ' KB limit. ' +
          'This page will have no heatmap background.'
        );
        return;
      }

      // Measure the document with the SAME logic the click/scroll coordinates are
      // normalized against (documentMetrics scans inner overflow:auto regions), so the
      // stored doc_w/doc_h match the coordinate system. Using a different measurement here
      // (plain scrollHeight) was making the preview the wrong height and pushing every dot
      // off its true position.
      metricsCache = null;
      const { dw, dh } = documentMetrics();

      queues.heatmap_dom_snapshot.push({
        type:  'heatmap_dom_snapshot',
        ts:    Date.now(),
        url:   location.href,
        sid:   core.getSessionId(),
        vid:   core.visitorId,
        doc_w: dw,
        doc_h: dh,
        vw:    window.innerWidth,
        vh:    window.innerHeight,
        data:  { html, page_version: pageVersion(), page_key: pageKeyOverride() },
      });

      lastSnapshot = lastSnapshot.path === location.pathname
        ? { path: location.pathname, height: dh, recaptures: lastSnapshot.recaptures + (force ? 1 : 0) }
        : { path: location.pathname, height: dh, recaptures: 0 };
      markSnapshotSentForPath();
      core.flush();
    } catch { /* non-critical — DOM serialization failures must not break the page */ }
  };

  // ─── Geometry ──────────────────────────────────────────────────────────────────

  /**
   * CSS layout viewport dimensions in pixels.
   * The dashboard uses these to size the heatmap overlay iframe to the correct breakpoint.
   * Uses visualViewport when available to handle pinch-zoom on mobile correctly.
   */
  const viewportCss = () => {
    const vv   = typeof visualViewport !== 'undefined' && visualViewport ? visualViewport : null;
    const rawW = vv?.width  ?? (typeof innerWidth  === 'number' ? innerWidth  : 0);
    const rawH = vv?.height ?? (typeof innerHeight === 'number' ? innerHeight : 0);
    return {
      vw: Math.max(1, Math.round(rawW)),
      vh: Math.max(1, Math.round(rawH)),
    };
  };

  /**
   * Cached result of the document dimension scan (1 s TTL).
   * The scan is expensive on large DOMs so we share its result across rapid
   * successive calls (e.g. rrweb emit bursts during a scroll).
   */
  let metricsCache = null;

  /**
   * Compute the full document bounding box (width × height in CSS pixels).
   *
   * documentElement.scrollHeight alone is insufficient for app shells that fix
   * the body height and scroll inside an inner container (e.g. a `main` element
   * with overflow:auto). We walk up to 3 000 body descendant nodes and take the
   * max scrollWidth / scrollHeight of any element that is actually overflowing.
   */
  const documentMetrics = () => {
    const now = typeof performance?.now === 'function' ? performance.now() : Date.now();
    if (metricsCache && now - metricsCache.at < 1_000) {
      return { dw: metricsCache.dw, dh: metricsCache.dh };
    }

    const docEl = document.documentElement;
    const body  = document.body;
    let dw = Math.max(1, docEl.scrollWidth, body?.scrollWidth ?? 0, docEl.clientWidth  || 1);
    let dh = Math.max(1, docEl.scrollHeight, body?.scrollHeight ?? 0, docEl.clientHeight || 1);

    // Scan descendant elements for overflow scroll regions.
    if (body) {
      try {
        const nodes = body.getElementsByTagName('*');
        const cap   = Math.min(nodes.length, 3_000);
        for (let i = 0; i < cap; i++) {
          const node = nodes[i];
          if (!(node instanceof HTMLElement)) continue;
          // Only expand the bounding box when the node is genuinely overflowing
          // (scrollable content exceeds its layout box by more than 4 px).
          if (node.scrollWidth  > node.clientWidth  + 4) dw = Math.max(dw, node.scrollWidth);
          if (node.scrollHeight > node.clientHeight + 4) dh = Math.max(dh, node.scrollHeight);
        }
      } catch { /* ignore — live NodeList can throw on certain mutations */ }
    }

    metricsCache = { at: now, dw, dh };
    return { dw, dh };
  };

  /**
   * Convert rrweb's viewport-relative (clientX, clientY) coordinates to document
   * (page) coordinates, accounting for both window scroll and any intermediate
   * overflow:auto ancestor scroll offsets (including shadow DOM hosts).
   *
   * rrweb records MouseInteraction and MouseMove positions in viewport space.
   * For apps with scrollable inner regions (dashboards, chat windows, etc.) we
   * need to add the scroll offset of each ancestor element to land on the correct
   * document position.
   */
  const clientToDocumentXY = (clientX, clientY) => {
    const docEl = document.documentElement;
    const body  = document.body;
    let pageX   = clientX + (window.scrollX ?? window.pageXOffset ?? 0);
    let pageY   = clientY + (window.scrollY ?? window.pageYOffset ?? 0);
    try {
      let el = document.elementFromPoint(clientX, clientY);
      while (el && el !== docEl && el !== body) {
        if (el instanceof HTMLElement) {
          pageX += el.scrollLeft;
          pageY += el.scrollTop;
        }
        // Pierce shadow DOM boundaries so positions inside web components are correct.
        const root = el.getRootNode();
        el = (root instanceof ShadowRoot && root.host) ? root.host : el.parentElement;
      }
    } catch { /* ignore — elementFromPoint can throw in sandboxed iframes */ }
    return { pageX, pageY };
  };

  // ─── Element locators ──────────────────────────────────────────────────────────

  /** Build a short CSS-selector hint for the clicked element (used for element-level reports). */
  const selectorHint = (el) => {
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id.replace(/\s/g, '')}`;
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      if (classes) return `${tag}.${classes}`;
    }
    return tag;
  };

  /** Fast, deterministic hash for non-sensitive text and structural fingerprints. */
  const hash = (value) => {
    let h = 0x811c9dc5;
    const s = String(value ?? '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  };

  const stableValue = (value, max = 96) => {
    const s = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
    if (!s || /@|\b\d{8,}\b|bearer|token|secret|password/i.test(s)) return '';
    return s;
  };

  const stableClasses = (el) => {
    if (!(el instanceof Element) || typeof el.className !== 'string') return [];
    return el.className.trim().split(/\s+/).filter(c =>
      c.length <= 48 &&
      !/[0-9a-f]{8,}/i.test(c) &&
      !/^css-[a-z0-9]{5,}$/i.test(c) &&
      !/^_/.test(c)
    ).slice(0, 4);
  };

  /** A structural path is a fallback only; stable annotations and accessibility win. */
  const elementPath = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node instanceof Element && depth < 6; depth++) {
      const tag = node.tagName.toLowerCase();
      let nth = 1;
      let prev = node.previousElementSibling;
      while (prev) {
        if (prev.tagName === node.tagName) nth++;
        prev = prev.previousElementSibling;
      }
      parts.unshift(`${tag}:nth-of-type(${nth})`);
      const root = node.getRootNode?.();
      node = root instanceof ShadowRoot ? root.host : node.parentElement;
    }
    return parts.join('>');
  };

  const positionMode = (el) => {
    let node = el;
    for (let depth = 0; node instanceof Element && depth < 8; depth++, node = node.parentElement) {
      try {
        const p = getComputedStyle(node).position;
        if (p === 'fixed' || p === 'sticky') return p;
      } catch { /* detached element */ }
    }
    return 'normal';
  };

  /** Multi-signal locator. No input value or raw user text is ever included. */
  const elementLocator = (el) => {
    const ancestry = [];
    let parent = el.parentElement;
    for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
      ancestry.push({
        tag: parent.tagName.toLowerCase(),
        id: stableValue(parent.id, 64),
        role: stableValue(parent.getAttribute('role'), 40),
        classes: stableClasses(parent),
      });
    }
    const label = stableValue(el.getAttribute('aria-label') || el.getAttribute('title') || '', 96);
    const text = stableValue(el.textContent || '', 120);
    const root = el.getRootNode?.();
    return {
      seentics_id: stableValue(el.getAttribute('data-seentics-id'), 96),
      test_id: stableValue(el.getAttribute('data-testid'), 96),
      id: stableValue(el.id, 96),
      tag: el.tagName.toLowerCase(),
      role: stableValue(el.getAttribute('role'), 40),
      aria_label: label,
      classes: stableClasses(el),
      ancestry,
      sibling_index: el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0,
      css_path: elementPath(el),
      text_hash: text ? hash(text.toLowerCase()) : '',
      shadow_host_path: root instanceof ShadowRoot ? elementPath(root.host) : '',
    };
  };

  let pageFingerprintCache = null;
  const pageVersion = () => {
    const now = Date.now();
    if (
      pageFingerprintCache &&
      pageFingerprintCache.url === location.href &&
      now - pageFingerprintCache.at < 1_000
    ) return pageFingerprintCache.value;

    const parts = [];
    try {
      const nodes = document.body?.querySelectorAll('*') ?? [];
      const cap = Math.min(nodes.length, 1_200);
      for (let i = 0; i < cap; i++) {
        const el = nodes[i];
        const sid = stableValue(el.getAttribute('data-seentics-id'), 48);
        const id = stableValue(el.id, 48);
        const role = stableValue(el.getAttribute('role'), 24);
        parts.push(`${el.tagName}:${sid || id}:${role}:${el.childElementCount}`);
      }
    } catch { /* hostile live DOM */ }
    const variant = stableValue(document.body?.getAttribute('data-seentics-variant'), 64);
    const value = `${variant || 'default'}:${hash(parts.join('|'))}`;
    pageFingerprintCache = { url: location.href, at: now, value };
    return value;
  };

  const eventId = () => {
    try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch { /* unavailable */ }
    return `hm-${Date.now().toString(36)}-${core.rnd()}`;
  };

  /** Explicit logical page name for template heatmaps (`data-seentics-page`). */
  const pageKeyOverride = () => {
    const value = stableValue(document.body?.getAttribute('data-seentics-page'), 96);
    if (!value) return '';
    const slug = value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return slug ? `/@${slug}` : '';
  };

  /** CSS-pixel click geometry plus an element-relative anchor. */
  const clickData = (rawTarget, clientX, clientY, pageX, pageY) => {
    const target = rawTarget.closest?.(
      '[data-seentics-id],button,a,input,select,textarea,[role]'
    ) || rawTarget;
    const rect = target.getBoundingClientRect();
    const { dw, dh } = documentMetrics();
    const vp = viewportCss();
    const rx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const ry = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    const locator = elementLocator(target);
    const stableTarget = locator.seentics_id
      ? `[data-seentics-id="${locator.seentics_id}"]`
      : locator.id
        ? `${locator.tag}#${locator.id}`
        : locator.test_id
          ? `[data-testid="${locator.test_id}"]`
          : selectorHint(target);
    return {
      event_id: eventId(),
      nx: Math.min(1, Math.max(0, pageX / dw)),
      ny: Math.min(1, Math.max(0, pageY / dh)),
      target: stableTarget,
      vw: vp.vw,
      vh: vp.vh,
      client_x: clientX,
      client_y: clientY,
      page_x: pageX,
      page_y: pageY,
      scroll_x: window.scrollX ?? window.pageXOffset ?? 0,
      scroll_y: window.scrollY ?? window.pageYOffset ?? 0,
      document_width: Math.round(dw),
      document_height: Math.round(dh),
      device_pixel_ratio: window.devicePixelRatio || 1,
      target_locator: locator,
      target_rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      relative_x: Math.min(1, Math.max(0, rx)),
      relative_y: Math.min(1, Math.max(0, ry)),
      position_mode: positionMode(target),
      page_version: pageVersion(),
      page_key: pageKeyOverride(),
      tracker_version: TRACKER_VERSION,
      schema_version: HEATMAP_SCHEMA_VERSION,
    };
  };

  // ─── Queueing ──────────────────────────────────────────────────────────────────

  /** Queued heatmap events that trigger a flush ahead of the periodic one (~1 KB each). */
  const EARLY_FLUSH = 25;
  let earlyFlushScheduled = false;

  const queueEvent = (event) => {
    // Clicks are never sampled. Bound memory by evicting the oldest queued scroll
    // summaries first, then the oldest event if a host page is producing pathological data.
    if (queues.heatmaps.length >= HEATMAP_QUEUE_MAX) {
      const scrollIndex = queues.heatmaps.findIndex(e => e.type === 'heatmap_scroll');
      queues.heatmaps.splice(scrollIndex >= 0 ? scrollIndex : 0, 1);
    }
    queues.heatmaps.push(event);
    // A busy page (many clicks in a few seconds) should not wait for the periodic flush:
    // the longer the queue, the more of it depends on the unload flush, which browsers
    // cap at about 64 KB. Flush early once a batch's worth has built up.
    if (queues.heatmaps.length >= EARLY_FLUSH && !earlyFlushScheduled) {
      earlyFlushScheduled = true;
      setTimeout(() => { earlyFlushScheduled = false; core.flush(); }, 0);
    }
  };

  const queueClick = (target, clientX, clientY, pageX, pageY, sid) => {
    queueEvent({
      type: 'heatmap_click',
      data: clickData(target, clientX, clientY, pageX, pageY),
      ts:  Date.now(),
      url: location.href,
      sid,
      vid: core.visitorId,
    });
  };

  // ─── Scroll summaries ──────────────────────────────────────────────────────────

  let scrollView = null;

  const visibleRange = () => {
    const { dh } = documentMetrics();
    const top = Math.max(0, window.scrollY ?? window.pageYOffset ?? 0);
    return {
      start: Math.round(top),
      end: Math.round(Math.min(dh, top + viewportCss().vh)),
      documentHeight: Math.round(dh),
    };
  };

  const updateScrollView = () => {
    const view = scrollView;
    if (!view || view.finished) return;
    const now = Date.now();
    const range = visibleRange();
    view.maximumDepth = Math.max(view.maximumDepth, Math.min(1, range.end / Math.max(1, range.documentHeight)));
    const durationMs = Math.max(0, Math.min(5_000, now - view.lastAt));
    const last = view.viewedRanges[view.viewedRanges.length - 1];
    if (last && range.start <= last.end + 24 && range.end >= last.start - 24) {
      last.start = Math.min(last.start, range.start);
      last.end = Math.max(last.end, range.end);
      last.duration_ms += durationMs;
    } else if (view.viewedRanges.length < 64) {
      view.viewedRanges.push({ start: range.start, end: range.end, duration_ms: durationMs });
    }
    view.lastAt = now;
    view.documentHeight = range.documentHeight;
    if (location.href === view.url) view.version = pageVersion();
    scheduleGrowthRecapture();
  };

  const startScrollView = () => {
    const range = visibleRange();
    scrollView = {
      id: eventId(),
      url: location.href,
      sid: core.getSessionId(),
      allowed: heatmapAllowed(),
      version: pageVersion(),
      pageKey: pageKeyOverride(),
      maximumDepth: Math.min(1, range.end / Math.max(1, range.documentHeight)),
      documentHeight: range.documentHeight,
      lastAt: Date.now(),
      viewedRanges: [{ start: range.start, end: range.end, duration_ms: 0 }],
      finished: false,
    };
  };

  /** Exactly one scroll summary per page view; intensity now represents page views. */
  const finishScrollView = () => {
    const view = scrollView;
    if (!view || view.finished) return;
    updateScrollView();
    view.finished = true;
    if (!view.allowed) return;
    const vp = viewportCss();
    queueEvent({
      type: 'heatmap_scroll',
      data: {
        event_id: view.id,
        page_view_id: view.id,
        depth: view.maximumDepth,
        maximum_depth_percent: Math.round(view.maximumDepth * 10_000) / 100,
        viewed_ranges: view.viewedRanges,
        vw: vp.vw,
        vh: vp.vh,
        document_width: documentMetrics().dw,
        document_height: view.documentHeight,
        page_version: view.version,
        page_key: view.pageKey,
        tracker_version: TRACKER_VERSION,
        schema_version: HEATMAP_SCHEMA_VERSION,
      },
      ts: Date.now(),
      url: view.url,
      sid: view.sid,
      vid: core.visitorId,
    });
  };

  // ─── Listeners ─────────────────────────────────────────────────────────────────

  /**
   * The most recent pointerdown's page coordinates.
   * rrweb's MouseInteraction click event carries viewport (client) coordinates, but
   * for accurate heatmap positioning we prefer the page coordinates from the native
   * pointerdown which fired just before rrweb's synthetic click. This bridge captures
   * them and the rrweb mirror reads them back within a 900 ms window.
   */
  let lastPointer = null;

  document.addEventListener('pointerdown', (ev) => {
    if (cfg().heatmap_enabled === false) return;
    if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen' && ev.pointerType !== 'touch') return;
    lastPointer = {
      pageX:   ev.pageX,
      pageY:   ev.pageY,
      clientX: ev.clientX,
      clientY: ev.clientY,
      at: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
  }, true);

  // While rrweb records, `mirror` derives clicks and scrolls from its event stream, so
  // these listeners stand down rather than count everything twice.
  document.addEventListener('click', (ev) => {
    if (core.recording || !heatmapAllowed()) return;
    const target = ev.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-seentics-block], [data-private]')) return;
    queueClick(target, ev.clientX, ev.clientY, ev.pageX, ev.pageY, core.getSessionId());
  }, true);

  /**
   * Scroll is throttled to one update per 200 ms. It used to run on every scroll event —
   * dozens a second, each reading layout (and, once a second, walking up to 3 000
   * elements) — on the main thread while the visitor was trying to scroll. The summary
   * keeps visited ranges and dwell time, which a 200 ms sample loses nothing of.
   */
  let scrollPending = false;
  window.addEventListener('scroll', () => {
    if (scrollPending) return;
    scrollPending = true;
    setTimeout(() => {
      scrollPending = false;
      if (core.recording || !heatmapAllowed()) return;
      updateScrollView();
    }, 200);
  }, { passive: true });

  /**
   * Inspect each rrweb event emitted during recording and derive heatmap data points.
   * This lets heatmaps work even when session recording is active without adding a
   * second set of separate DOM listeners.
   *
   * NOTE: rrweb MouseMove batches are intentionally NOT mirrored. They used to be
   * queued as `heatmap_click` points, which (a) polluted click heatmaps with hover
   * positions — nothing downstream distinguished them from real clicks — and
   * (b) forced a full document-metrics rescan (~3000 elements, layout reflow)
   * every 350 ms while the mouse moved.
   */
  const mirror = (ev) => {
    // `heatmapAllowed()`, not just `heatmap_enabled` — this path is the *only* one
    // capturing while replay records, because the DOM listeners above stand down. Checking
    // the flag alone meant include/exclude patterns were silently ignored on every page
    // where a session was being recorded.
    if (Number(ev?.type) !== RRWEB_INCREMENTAL_SNAPSHOT || !heatmapAllowed()) return;

    const inner = ev.data;
    if (!inner || typeof inner !== 'object') return;
    const source = Number(inner.source);

    if (source === RRWEB_SOURCE_MOUSE_INTERACTION && Number(inner.type) === RRWEB_MOUSE_CLICK) {
      const clientX = Number(inner.x);
      const clientY = Number(inner.y);
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

      // Invalidate the metrics cache: page may have scrolled between last sample and this click.
      metricsCache = null;

      const now    = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const bridge = lastPointer;
      let pageX, pageY;

      // Prefer the page coordinates from the native pointerdown bridge (more accurate for
      // overflow-scroll regions) if it fired within 900 ms and is within 8 px of this click.
      if (
        bridge &&
        now - bridge.at < 900 &&
        Math.abs(bridge.clientX - clientX) <= 8 &&
        Math.abs(bridge.clientY - clientY) <= 8
      ) {
        pageX = bridge.pageX;
        pageY = bridge.pageY;
        lastPointer = null;
      } else {
        ({ pageX, pageY } = clientToDocumentXY(clientX, clientY));
      }

      let target = null;
      try { target = document.elementFromPoint(clientX, clientY); } catch { /* sandbox */ }
      if (!(target instanceof Element) || target.closest('[data-seentics-block], [data-private]')) return;
      queueClick(target, clientX, clientY, pageX, pageY, core.recordingSessionId ?? core.getSessionId());
      return;
    }

    if (source === RRWEB_SOURCE_SCROLL) updateScrollView();
  };

  // This extension arrives after the first page view was tracked: begin its scroll
  // summary and layout capture now.
  startScrollView();
  scheduleSnapshot();

  return {
    /** A page view ends (navigation, manual `page()`, the tab closing). */
    pageEnd: finishScrollView,
    /** A page view begins. */
    pageStart: () => {
      pageFingerprintCache = null;
      lastPointer = null;
      startScrollView();
    },
    /** A SPA navigation changed the path: capture the new route's layout. */
    navigated: () => {
      clearSnapshotTimers();
      window.setTimeout(() => { pageFingerprintCache = null; }, 250);
      scheduleSnapshot();
    },
    beforeLeave: captureBeforeLeaving,
    mirror,
  };
});
