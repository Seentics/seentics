/**
 * How a lazily loaded tracker extension hands itself to the core.
 *
 * The core (seentics.js) injects an extension as a plain <script>, then reads its factory
 * from `window.__sncx`, keyed by the extension's own file name. Keying by file name
 * rather than by feature means two different tracker builds on one page (a site that
 * upgraded half its templates) never run each other's extensions: each core asks for
 * the exact content-hashed file it was built with.
 *
 * The factory receives the core's API and returns the extension's interface. It holds no
 * state of its own until called, so two trackers on one page each get their own instance.
 */
export const registerExtension = (factory) => {
  const src = document.currentScript?.src ?? '';
  const file = src.split(/[?#]/)[0].split('/').pop();
  if (!file) return;
  (window.__sncx || (window.__sncx = {}))[file] = factory;
};
