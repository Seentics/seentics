/**
 * Countdown timer for popups and bars.
 *
 * Two modes. `fixed` counts down to one moment for everybody (a sale that really ends).
 * `evergreen` gives each visitor their own window starting the first time they see the
 * timer, remembered in localStorage so a reload does not restart it. Where storage is
 * unavailable an evergreen timer simply starts fresh each page — it must never throw.
 *
 * The arithmetic is pure and exported so it can be tested without a DOM or a clock.
 */
import { el, safeStorage } from './popup-util.js';

const pad = (n) => String(n).padStart(2, '0');

/** Milliseconds left; never negative, and 0 for a timer whose configuration is unusable. */
export const remainingMs = (cfg, now, startedAt) => {
  const end = cfg.mode === 'fixed'
    ? Date.parse(cfg.ends_at)
    : startedAt + (Number(cfg.duration_minutes) || 0) * 60_000;
  return Number.isFinite(end) ? Math.max(0, end - now) : 0;
};

/** `01:02:03`, or `2d 01:02:03` once a day or more remains. */
export const formatRemaining = (ms) => {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(total / 86_400);
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
};

/** When this visitor's evergreen window began — now, the first time. */
export const evergreenStart = (key, now) => {
  const storageKey = `snc_cd:${key}`;
  const saved = Number(safeStorage.get(storageKey));
  if (Number.isFinite(saved) && saved > 0 && saved <= now) return saved;
  safeStorage.set(storageKey, String(now));
  return now;
};

/**
 * Put a live timer in `container`.
 *
 * `onExpire(hide)` runs once when time is up; `hide` is the owner's `hide_on_expire`, and
 * the caller decides what closing means for its surface. Returns `{ stop }` — callers must
 * stop it when the popup goes away, or the interval outlives it.
 */
export const mountCountdown = (container, cfg, { key = 'default', now = () => Date.now(), onExpire } = {}) => {
  const started = cfg.mode === 'evergreen' ? evergreenStart(key, now()) : 0;
  const node = el('div', { className: 'snc-countdown' });
  node.setAttribute('data-snc', 'countdown');
  node.setAttribute('role', 'timer');
  const label = cfg.label ? el('span', { className: 'snc-countdown-label', textContent: cfg.label }) : null;
  const clock = el('span', { className: 'snc-countdown-clock' });
  if (label) node.append(label);
  node.append(clock);
  container.append(node);

  let timer = null;
  const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
  const tick = () => {
    const left = remainingMs(cfg, now(), started);
    if (left > 0) { clock.textContent = formatRemaining(left); return; }
    stop();
    node.classList.add('snc-countdown-expired');
    clock.textContent = cfg.expired_text || 'This offer has ended.';
    if (label) label.remove();
    if (onExpire) onExpire(cfg.hide_on_expire === true);
  };

  tick();
  if (remainingMs(cfg, now(), started) > 0) timer = setInterval(tick, 1000);
  return { el: node, stop };
};
