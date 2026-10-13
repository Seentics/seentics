/**
 * Small helpers shared by the popup renderers.
 *
 * Plain functions with no state, split out so the renderers, the form and the
 * extension's remaining actions (toast, tooltip) all escape and validate the same way.
 * Like the rest of the popup modules this is bundled into the automations extension (and
 * into the dashboard's live preview); it is not a script a page loads on its own.
 */

/** Escape a string for safe interpolation into innerHTML (text or attribute position). */
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Allow only http(s)/relative URLs in injected href/src — blocks javascript: etc. */
export const safeActionUrl = (u) => {
  const s = String(u ?? '').trim();
  return /^(https?:\/\/|\/)/i.test(s) ? escapeHtml(s) : '#';
};

/** The unescaped test behind `safeActionUrl`, for places that assign `location.href`. */
export const isSafeRedirect = (u) => /^(https?:\/\/|\/(?!\/))/i.test(String(u ?? '').trim());

/** Allow only plausible CSS color tokens in injected inline styles. */
export const safeColor = (c, fallback) => {
  const s = String(c ?? '').trim();
  return /^[#a-zA-Z0-9(),.%\s-]{1,40}$/.test(s) && s ? s : fallback;
};

/**
 * The author's own markup, style and script for an action.
 *
 * `custom_html` replaces the action's built-in content, `custom_css` is added as a style
 * element inside the action's root (so it is removed with it), and `custom_js` runs once the
 * root is on the page, with `root` and `action` in scope. They are the site owner's own
 * code on the site owner's own page: a script that throws is caught and must never break
 * the page, and a site whose CSP forbids evaluating code simply skips the script.
 */
export const hasCustomHtml = (action) => typeof action.custom_html === 'string' && action.custom_html.trim() !== '';

export const applyCustomCode = (root, action) => {
  if (typeof action.custom_css === 'string' && action.custom_css.trim() !== '') {
    const style = document.createElement('style');
    style.setAttribute('data-snc-custom', '');
    style.textContent = action.custom_css;
    root.appendChild(style);
  }
  if (typeof action.custom_js === 'string' && action.custom_js.trim() !== '') {
    try { new Function('root', 'action', action.custom_js)(root, action); }
    catch (err) { try { console.warn('[seentics] custom_js failed:', err); } catch { /* no console */ } }
  }
};

/**
 * Build an element. Properties are assigned, never parsed, so owner text passed as
 * `textContent` cannot become markup.
 */
export const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) node.append(child);
  return node;
};

/** Whether the visitor asked for less motion. Animations check this and snap instead. */
export const prefersReducedMotion = () => {
  try { return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};

/** localStorage that never throws: private windows and blocked storage just return null. */
export const safeStorage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* unavailable */ } },
};
