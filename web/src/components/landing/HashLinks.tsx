'use client';

import { useEffect } from 'react';

/** How long after a load with a #hash the section is kept in place while the page above it settles. */
const SETTLE_MS = 4000;

/**
 * Makes in-page links (`#pricing`, `/#faq` on the home page) always land on their section.
 *
 * Two cases the browser and Next.js get wrong on their own:
 * - A link to the hash already in the address does nothing: Next.js skips a navigation to the
 *   URL it is on, so "Pricing" works once and then not again until the hash changes.
 * - On a load with a hash, the page above the section keeps growing after the browser has
 *   jumped (the product preview and images load in). Chrome compensates; Safari has no scroll
 *   anchoring, so the section ends up below where it should be. The jump is repeated as the
 *   page grows, until the visitor scrolls themselves.
 */
export function HashLinks() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = (hash: string) => {
      if (hash.length < 2) return null;
      try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
    };

    // Capture phase: decided before Next's Link handler, which would ignore a same-URL click.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      const el = target(url.hash);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      if (location.hash !== url.hash) history.pushState(history.state, '', url.hash);
    };
    document.addEventListener('click', onClick, true);

    // Keep a hash load on its section while the page above it settles.
    let stop = () => {};
    const initial = target(location.hash);
    if (initial) {
      let userMoved = false;
      const moved = () => { userMoved = true; };
      const opts = { passive: true, once: true } as const;
      window.addEventListener('wheel', moved, opts);
      window.addEventListener('touchstart', moved, opts);
      window.addEventListener('keydown', moved, { once: true });
      const realign = () => {
        if (userMoved) return;
        const el = target(location.hash);
        if (el && Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).scrollMarginTop || '0')) > 2) {
          el.scrollIntoView({ block: 'start' });
        }
      };
      const ro = new ResizeObserver(realign);
      ro.observe(document.body);
      const timer = window.setTimeout(() => stop(), SETTLE_MS);
      stop = () => {
        ro.disconnect();
        window.clearTimeout(timer);
        window.removeEventListener('wheel', moved);
        window.removeEventListener('touchstart', moved);
        window.removeEventListener('keydown', moved);
      };
    }

    return () => { document.removeEventListener('click', onClick, true); stop(); };
  }, []);

  return null;
}
