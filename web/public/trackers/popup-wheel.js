/**
 * The prize wheel.
 *
 * Drawing only. Which slice wins is decided by the server when the visitor submits the
 * form, and this animates to the slice it is told: a wheel that picked its own winner in
 * the browser would be a coupon generator for anyone with devtools.
 *
 * Built from a conic-gradient disc with one label per slice, rather than SVG, so the
 * labels are ordinary text nodes (set with `textContent`) that wrap, truncate and read
 * like any other text on the page.
 */
import { el, prefersReducedMotion, safeColor } from './popup-util.js';

const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#eab308'];
const SPIN_MS = 4500;

/**
 * How far to turn the wheel so slice `index` ends under the pointer at the top.
 *
 * Slice `i` covers [i, i+1) × (360/count) degrees clockwise from the top; turning the disc
 * clockwise by R brings the point at disc-angle (−R mod 360) under the pointer, so R is
 * whole turns minus the slice's centre. `jitter` in [−0.4, 0.4] lands off-centre, inside
 * the slice, so repeated spins do not stop on exactly the same pixel.
 */
export const wheelRotation = (index, count, turns = 5, jitter = 0) => {
  const slice = 360 / count;
  return turns * 360 - (index + 0.5 + jitter) * slice;
};

/** The disc's background: one conic-gradient stop pair per slice. */
export const wheelGradient = (segments) => {
  const slice = 360 / segments.length;
  const stops = segments.map((s, i) => {
    const color = safeColor(s.color, PALETTE[i % PALETTE.length]);
    return `${color} ${(i * slice).toFixed(3)}deg ${((i + 1) * slice).toFixed(3)}deg`;
  });
  return `conic-gradient(${stops.join(',')})`;
};

/** `{ el, spinTo(index) → Promise }`. The promise resolves when the wheel has stopped. */
export const buildWheel = (segments) => {
  const wrap = el('div', { className: 'snc-wheel-wrap' });
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `Prize wheel with ${segments.length} slices: ${segments.map((s) => s.label).join(', ')}`);

  const disc = el('div', { className: 'snc-wheel' });
  disc.style.background = wheelGradient(segments);
  const slice = 360 / segments.length;
  segments.forEach((s, i) => {
    const label = el('div', { className: 'snc-wheel-label' }, [el('span', { textContent: s.label })]);
    label.style.transform = `rotate(${((i + 0.5) * slice - 90).toFixed(3)}deg)`;
    disc.append(label);
  });
  wrap.append(disc, el('div', { className: 'snc-wheel-pointer' }));

  let spun = false;
  const spinTo = (index) => new Promise((resolve) => {
    if (spun || !(index >= 0 && index < segments.length)) { resolve(); return; }
    spun = true;
    const jitter = (Math.random() - 0.5) * 0.7;
    const target = wheelRotation(index, segments.length, 5, jitter);
    if (prefersReducedMotion()) {
      disc.style.transition = 'none';
      disc.style.transform = `rotate(${target}deg)`;
      resolve();
      return;
    }
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    disc.addEventListener('transitionend', finish, { once: true });
    // A backgrounded tab never fires transitionend; do not leave the visitor without a result.
    setTimeout(finish, SPIN_MS + 500);
    disc.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.17,.67,.12,1)`;
    // Next frame, so the browser has seen the starting angle and the change animates.
    requestAnimationFrame(() => { disc.style.transform = `rotate(${target}deg)`; });
  });

  return { el: wrap, spinTo };
};
