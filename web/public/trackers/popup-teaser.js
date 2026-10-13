/**
 * A small tab fixed to the edge of the page that opens the full popup when clicked.
 *
 * Less intrusive than a popup in the middle of the screen and usually kept on screen
 * longer, which is the point: the offer stays visible without covering the page.
 */
import { el } from './popup-util.js';

export const mountTeaser = (root, cfg, onOpen) => {
  const tab = el('button', { type: 'button', className: `snc-teaser snc-teaser-${cfg.position || 'right'}`, textContent: cfg.label || 'Get 10% off' });
  tab.setAttribute('data-snc', 'teaser');
  tab.addEventListener('click', () => { tab.remove(); onOpen(); });
  root.append(tab);
  return {
    el: tab,
    /** Put the tab back, e.g. after the visitor closed the full popup. */
    show() { if (!tab.isConnected) root.append(tab); },
    remove() { tab.remove(); },
  };
};
