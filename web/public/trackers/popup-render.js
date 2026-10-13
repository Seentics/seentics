/**
 * Renders the popups: modals (plain, spin wheel, multi-step, countdown, teaser) and bars.
 *
 * One implementation for two callers. The tracker's automations extension calls it with
 * `document.body`; the dashboard's live preview calls it with a box inside the builder.
 * Passing a container is what makes the preview honest — the owner sees the code that
 * will run on their site, not a lookalike that can drift from it.
 *
 * `env`:
 *   root    the element popups are added to. Defaults to `document.body`; any other element
 *           is treated as a contained surface (surfaces anchor to it, no focus is taken, and
 *           Escape is heard only inside it).
 *   submit  `(action, payload) → Promise<false | { prize }>`, the lead submission. The
 *           tracker posts it; the preview fakes it. Falsy means "failed, let them retry".
 *
 * Owner-written text only ever reaches the DOM as `textContent`. The one exception is the
 * author's explicit `custom_html`, which is theirs to write and is unchanged from before.
 */
import { buildForm, successNode } from './popup-form.js';
import { couponNode } from './popup-coupon.js';
import { mountCountdown } from './popup-countdown.js';
import { buildSteps } from './popup-steps.js';
import { ensureStyles } from './popup-styles.js';
import { mountTeaser } from './popup-teaser.js';
import { buildWheel } from './popup-wheel.js';
import { applyCustomCode, el, hasCustomHtml, isSafeRedirect, safeColor } from './popup-util.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])';
/** How long a thank-you stays before the popup closes itself, when there is nothing to copy. */
const AUTO_CLOSE_MS = 4000;
const REDIRECT_MS = 1500;

/** The wheel slice a prize refers to, or -1. The server sends the slice's position as its id. */
export const wheelIndexOf = (prize, count) => {
  const index = prize ? Number(prize.id) : NaN;
  return Number.isInteger(index) && index >= 0 && index < count ? index : -1;
};

export const createPopupRenderer = (env = {}) => {
  const root = env.root || document.body;
  const contained = root !== document.body;
  const submit = env.submit || (async () => false);
  const live = new Set();

  const prepare = () => {
    ensureStyles();
    if (contained) root.classList.add('snc-contained');
  };

  const track = (handle) => { live.add(handle); return handle; };

  const colorsOf = (action) => ({
    bg: safeColor(action.background_color, '#ffffff'),
    text: safeColor(action.text_color, '#000000'),
    button: safeColor(action.button_color, '#2563eb'),
    buttonText: safeColor(action.button_text_color, '#ffffff'),
  });

  const linkButton = (action, colors) => {
    const a = el('a', { className: 'snc-modal-btn', textContent: action.button_text });
    a.style.background = colors.button;
    a.style.color = colors.buttonText;
    if (action.button_url && isSafeRedirect(action.button_url)) a.href = action.button_url;
    else { a.href = '#'; a.addEventListener('click', (e) => e.preventDefault()); }
    return a;
  };

  /**
   * Mount the lead form in `slot`.
   *
   * `answers` are what earlier steps collected; they travel with the form's own fields so
   * the lead arrives with its context. `spin` relabels the button for the wheel.
   */
  const mountForm = (slot, action, { answers = {}, colors, spin, onDone }) => {
    const formAction = spin ? { ...action, form: { ...action.form, submit_text: action.wheel.spin_text || 'Spin to win' } } : action;
    const form = buildForm(formAction, {
      colors,
      submit: (payload) => submit(action, { ...payload, fields: { ...answers, ...payload.fields } }),
      onSuccess: (result) => onDone(result),
    });
    slot.replaceChildren(form);
    if (!contained && form.__firstInput) form.__firstInput.focus({ preventScroll: true });
    return form;
  };

  /**
   * What the visitor sees once the form is accepted: the thank-you, and the prize if the
   * server sent one. A wheel prize is announced in its own words ("You won 10% off!") and
   * a no-prize slice just says what it says.
   */
  const resultNodes = (action, prize) => {
    const cfg = action.form || {};
    const nodes = [];
    if (prize && action.layout === 'spin_wheel') {
      nodes.push(successNode(prize.coupon_code ? `You won: ${prize.label}!` : prize.label));
      if (prize.coupon_code) nodes.push(couponNode({ coupon_code: prize.coupon_code, label: '' }));
    } else {
      nodes.push(successNode(cfg.success_message));
      if (prize && prize.coupon_code) nodes.push(couponNode(prize));
    }
    return nodes;
  };

  // ─── Modal ───────────────────────────────────────────────────────────────────

  const mountModal = (action, { onClose, onSubmitted } = {}) => {
    prepare();
    const colors = colorsOf(action);
    const custom = hasCustomHtml(action);
    const overlay = el('div', { className: 'snc-overlay' });
    const modal = el('div', { className: 'snc-modal' });
    modal.setAttribute('data-snc', 'modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (action.title) modal.setAttribute('aria-label', String(action.title));
    modal.style.background = colors.bg;
    modal.style.color = colors.text;

    const closeButton = el('button', { type: 'button', className: 'snc-modal-close', textContent: '×' });
    closeButton.setAttribute('aria-label', 'Close');
    modal.append(closeButton);
    overlay.append(modal);

    const timers = [];
    const cleanups = [];
    let closed = false;
    const previouslyFocused = contained ? null : document.activeElement;

    const close = () => {
      if (closed) return;
      closed = true;
      timers.forEach(clearTimeout);
      cleanups.forEach((fn) => fn());
      overlay.remove();
      if (previouslyFocused && previouslyFocused.focus) { try { previouslyFocused.focus({ preventScroll: true }); } catch { /* gone */ } }
      live.delete(handle);
      if (onClose) onClose();
    };
    const handle = { close, destroy: close };

    if (custom) {
      const body = el('div', { className: 'snc-custom' });
      body.innerHTML = action.custom_html;
      modal.append(body);
    } else {
      buildContent(action, modal, colors, { cleanups, timers, close, onSubmitted });
    }

    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Escape closes and Tab stays inside, as a dialog should. A contained preview listens
    // only on itself so it cannot steal keys from the dashboard around it.
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      const items = [...modal.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const keyTarget = contained ? overlay : document;
    keyTarget.addEventListener('keydown', onKey);
    cleanups.push(() => keyTarget.removeEventListener('keydown', onKey));

    root.appendChild(overlay);
    if (!contained && !modal.contains(document.activeElement)) {
      (modal.querySelector('input:not([tabindex="-1"]),.snc-step-option') || closeButton).focus({ preventScroll: true });
    }
    applyCustomCode(overlay, action);
    return track(handle);
  };

  /** The modal's body, by layout. Kept apart from `mountModal`, which owns the dialog behaviour. */
  const buildContent = (action, modal, colors, { cleanups, timers, close, onSubmitted }) => {
    if (action.image_url && isSafeRedirect(action.image_url)) {
      const img = el('img', { src: action.image_url, alt: '' });
      img.style.cssText = 'width:100%;border-radius:4px;margin-bottom:12px';
      modal.append(img);
    }
    if (action.title) modal.append(el('h2', { textContent: action.title }));
    if (action.body) modal.append(el('p', { textContent: action.body }));

    if (action.countdown) {
      const holder = el('div');
      modal.append(holder);
      const timer = mountCountdown(holder, action.countdown, {
        key: action.automation_id || 'preview',
        onExpire: (hide) => { if (hide) close(); },
      });
      cleanups.push(timer.stop);
    }

    const slot = el('div', { className: 'snc-slot' });
    // `target` is where the form was mounted: the steps' final step has its own slot.
    const done = (target, result) => {
      if (onSubmitted) onSubmitted();
      finish(action, target, result || {}, { timers, close });
    };

    if (action.layout === 'spin_wheel' && action.wheel && action.form) {
      const wheel = buildWheel(action.wheel.segments);
      modal.append(wheel.el, slot);
      // The slice comes from the server; the wheel only animates to it.
      mountForm(slot, action, {
        colors, spin: true,
        onDone: async (result) => {
          const index = wheelIndexOf(result.prize, action.wheel.segments.length);
          if (index >= 0) {
            slot.replaceChildren(successNode('Good luck…'));
            await wheel.spinTo(index);
          }
          done(slot, result);
        },
      });
    } else if (action.layout === 'multi_step' && action.steps && action.form) {
      const steps = buildSteps(action.steps, {
        renderFinal: (answers, finalSlot) => mountForm(finalSlot, action, { answers, colors, onDone: (result) => done(finalSlot, result) }),
      });
      modal.append(steps.el);
    } else if (action.form) {
      modal.append(slot);
      mountForm(slot, action, { colors, onDone: (result) => done(slot, result) });
    } else {
      if (action.button_text) modal.append(linkButton(action, colors));
      if (action.coupon && action.coupon.code) modal.append(couponNode({ label: action.coupon.description, coupon_code: action.coupon.code }));
    }
  };

  /** Replace the form with its outcome, then close or redirect when nothing needs copying. */
  const finish = (action, slot, result, { timers, close }) => {
    const nodes = resultNodes(action, result.prize);
    slot.replaceChildren(...nodes);
    const hasCode = !!(result.prize && result.prize.coupon_code);
    const next = action.form && action.form.success_redirect_url ? String(action.form.success_redirect_url).trim() : '';
    if (hasCode) return;
    if (next && isSafeRedirect(next) && !contained) timers.push(setTimeout(() => { location.href = next; }, REDIRECT_MS));
    else timers.push(setTimeout(close, AUTO_CLOSE_MS));
  };

  const renderModal = (action) => {
    prepare();
    if (action.teaser && !hasCustomHtml(action)) {
      let modal = null;
      let submitted = false;
      const teaser = mountTeaser(root, action.teaser, () => {
        modal = mountModal(action, {
          onSubmitted: () => { submitted = true; },
          onClose: () => { modal = null; if (!submitted && action.teaser.reopen !== false) teaser.show(); },
        });
      });
      const handle = { close: () => { teaser.remove(); if (modal) modal.close(); }, destroy: () => handle.close() };
      return track(handle);
    }
    return mountModal(action);
  };

  // ─── Bar ─────────────────────────────────────────────────────────────────────

  const renderBanner = (action) => {
    prepare();
    const bg = safeColor(action.background_color, '#1e40af');
    const text = safeColor(action.text_color, '#ffffff');
    const banner = el('div', { className: `snc-banner ${action.position === 'bottom' ? 'bottom' : 'top'}` });
    banner.style.background = bg;
    banner.style.color = text;
    banner.setAttribute('data-snc', 'banner');

    const closeButton = el('button', { type: 'button', className: 'snc-banner-close', textContent: '×' });
    closeButton.setAttribute('aria-label', 'Close');

    const timers = [];
    const cleanups = [];
    const close = () => {
      timers.forEach(clearTimeout);
      cleanups.forEach((fn) => fn());
      banner.remove();
      live.delete(handle);
    };
    const handle = { close, destroy: close };
    closeButton.addEventListener('click', close);

    if (hasCustomHtml(action)) {
      const custom = el('div', { className: 'snc-custom' });
      custom.style.flex = '1';
      custom.innerHTML = action.custom_html;
      banner.append(custom, closeButton);
    } else {
      banner.append(el('span', { textContent: action.message ?? '' }));
      if (action.countdown) {
        const holder = el('span');
        banner.append(holder);
        const timer = mountCountdown(holder, action.countdown, {
          key: action.automation_id || 'preview',
          onExpire: (hide) => { if (hide) close(); },
        });
        cleanups.push(timer.stop);
      }
      if (action.form) {
        const slot = el('div', { className: 'snc-bar-slot' });
        slot.style.display = 'contents';
        banner.append(slot);
        // The submit button inverts the bar's colours so it reads as the action.
        mountForm(slot, action, {
          colors: { button: text, buttonText: bg },
          onDone: (result) => {
            const prize = (result || {}).prize;
            slot.replaceChildren(...resultNodes(action, prize));
            if (!(prize && prize.coupon_code)) timers.push(setTimeout(close, AUTO_CLOSE_MS + 2000));
          },
        });
      } else {
        if (action.button_text) {
          const a = el('a', { textContent: action.button_text });
          a.style.cssText = 'color:inherit;font-weight:600;text-decoration:underline;white-space:nowrap';
          if (action.button_url && isSafeRedirect(action.button_url)) a.href = action.button_url;
          else { a.href = '#'; a.addEventListener('click', (e) => e.preventDefault()); }
          banner.append(a);
        }
        if (action.coupon && action.coupon.code) banner.append(couponNode({ label: action.coupon.description, coupon_code: action.coupon.code }));
      }
      banner.append(closeButton);
    }

    root.appendChild(banner);
    applyCustomCode(banner, action);
    if (action.duration_ms) timers.push(setTimeout(close, action.duration_ms));
    return track(handle);
  };

  /** Remove everything this renderer put on the page. The preview calls it on every edit. */
  const destroy = () => { for (const handle of [...live]) handle.destroy(); live.clear(); };

  return { renderModal, renderBanner, destroy };
};
