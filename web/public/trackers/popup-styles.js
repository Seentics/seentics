/**
 * The popups' stylesheet, injected once.
 *
 * Every rule is scoped under a `.snc-*` class so a host page's own CSS cannot restyle a
 * popup and ours cannot leak onto the page. Colours the owner chose are applied inline by
 * the renderers; this holds structure, spacing and motion.
 *
 * `.snc-contained` re-anchors the fixed surfaces to a parent box. The dashboard's live
 * preview renders the same popups inside one, so what the owner sees is the code that runs
 * on their site rather than a lookalike.
 */
import { FORM_CSS } from './popup-form.js';

const BASE_CSS =
  '.snc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center}' +
  '.snc-modal{background:#fff;color:#111827;border-radius:8px;padding:24px;max-width:480px;width:90%;max-height:90vh;overflow:auto;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:inherit}' +
  // The host page's own `h2 {…}` and `p {…}` rules must not recolour what we show: a site
  // that greys its headings made the modal's title and text hard to read. Colour, font and
  // opacity are taken from the modal itself, which is where the author set them.
  '.snc-modal,.snc-modal *{box-sizing:border-box}' +
  '.snc-modal h2,.snc-modal h3,.snc-modal p,.snc-modal a.snc-modal-btn{font-family:inherit!important;opacity:1!important;text-transform:none!important;letter-spacing:normal!important}' +
  '.snc-modal h2,.snc-modal h3,.snc-modal p{color:inherit!important}' +
  '.snc-modal h2{margin:0 0 12px!important;font-size:20px!important;font-weight:700!important;line-height:1.3!important}' +
  '.snc-modal h3{margin:0 0 8px!important;font-size:17px!important;font-weight:700!important;line-height:1.3!important}' +
  '.snc-modal p{margin:0 0 16px!important;font-size:15px!important;line-height:1.5!important}' +
  '.snc-modal-close{position:absolute;top:10px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;line-height:1;color:inherit;opacity:.7}' +
  '.snc-modal-btn{display:inline-block;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;cursor:pointer;border:none;font-size:14px}' +
  '.snc-toast{position:fixed;z-index:2147483647;padding:12px 20px;border-radius:8px;background:#1a1a1a;color:#fff;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:360px;pointer-events:auto;transition:opacity .3s}' +
  '.snc-toast.top-left{top:20px;left:20px}' +
  '.snc-toast.top-right{top:20px;right:20px}' +
  '.snc-toast.bottom-left{bottom:20px;left:20px}' +
  '.snc-toast.bottom-right{bottom:20px;right:20px}' +
  '.snc-banner{position:fixed;left:0;right:0;z-index:2147483646;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.15)}' +
  '.snc-banner.top{top:0}.snc-banner.bottom{bottom:0}' +
  '.snc-banner-close{background:none;border:none;font-size:18px;cursor:pointer;padding:0;line-height:1;opacity:.7;color:inherit}' +
  '.snc-highlight-pulse{outline:3px solid #f59e0b!important;outline-offset:2px;animation:snc-pulse 1.5s infinite}' +
  '@keyframes snc-pulse{0%,100%{outline-color:#f59e0b}50%{outline-color:#ef4444}}' +
  '.snc-tooltip{position:absolute;background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:6px;font-size:13px;z-index:2147483647;pointer-events:none;max-width:240px;line-height:1.4}' +
  ".snc-tooltip::before{content:'';position:absolute;border:6px solid transparent}";

const WHEEL_CSS =
  '.snc-wheel-wrap{position:relative;width:240px;height:240px;max-width:100%;margin:4px auto 16px}' +
  '.snc-wheel{position:relative;width:100%;height:100%;border-radius:50%;border:4px solid rgba(0,0,0,.15);overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.2)}' +
  // A label is a zero-height strip from the centre to the rim, rotated onto its slice;
  // the text sits at the rim end of it.
  '.snc-wheel-label{position:absolute;top:50%;left:50%;width:50%;height:0;transform-origin:0 50%;display:flex;align-items:center;justify-content:flex-end;padding-right:14px;box-sizing:border-box}' +
  '.snc-wheel-label span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:11px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,.45)}' +
  '.snc-wheel-pointer{position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:20px solid #111827;z-index:2;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}';

const STEPS_CSS =
  '.snc-step-progress{font-size:12px!important;opacity:.7!important;margin:0 0 6px!important;text-align:left}' +
  '.snc-steps{text-align:left}' +
  '.snc-step-options{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}' +
  '.snc-step-option{width:100%;text-align:left;padding:10px 14px;border:1px solid rgba(0,0,0,.2);border-radius:6px;background:#fff;color:#111827;font:inherit;font-size:14px;cursor:pointer}' +
  '.snc-step-option:hover,.snc-step-option:focus-visible{border-color:currentColor;outline:none;box-shadow:0 0 0 2px rgba(37,99,235,.35)}' +
  '.snc-step-back{background:none;border:none;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer;color:inherit;opacity:.7;padding:0}';

const COUNTDOWN_CSS =
  '.snc-countdown{display:inline-flex;align-items:baseline;gap:8px;font-variant-numeric:tabular-nums;font-weight:700;margin:0 0 12px}' +
  '.snc-countdown-clock{font-size:22px;letter-spacing:.04em}' +
  '.snc-countdown-label{font-size:13px;font-weight:600;opacity:.85}' +
  '.snc-countdown-expired .snc-countdown-clock{font-size:14px;letter-spacing:0}' +
  '.snc-banner .snc-countdown{margin:0}.snc-banner .snc-countdown-clock{font-size:16px}';

const COUPON_CSS =
  '.snc-coupon{margin:8px 0 0;text-align:center}' +
  '.snc-coupon-label{font-weight:600}' +
  '.snc-coupon-row{display:inline-flex;gap:8px;align-items:stretch}' +
  '.snc-coupon-code{padding:8px 14px;border:2px dashed currentColor;border-radius:6px;font-size:18px;font-weight:700;letter-spacing:.08em;user-select:all}' +
  '.snc-coupon-copy{padding:8px 12px;border:1px solid rgba(0,0,0,.25);border-radius:6px;background:#fff;color:#111827;font:inherit;font-size:13px;cursor:pointer}';

const TEASER_CSS =
  '.snc-teaser{position:fixed;z-index:2147483645;border:none;cursor:pointer;background:#2563eb;color:#fff;font:inherit;font-size:14px;font-weight:700;padding:10px 16px;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .2s}' +
  '.snc-teaser:hover,.snc-teaser:focus-visible{transform:translateY(-2px);outline:2px solid #fff;outline-offset:-4px}' +
  '.snc-teaser-right{right:0;top:50%;transform-origin:100% 100%;transform:translateY(-50%) rotate(-90deg) translateX(50%);border-radius:8px 8px 0 0;margin-right:-1px}' +
  '.snc-teaser-left{left:0;top:50%;transform-origin:0 100%;transform:translateY(-50%) rotate(90deg) translateX(-50%);border-radius:8px 8px 0 0;margin-left:-1px}' +
  '.snc-teaser-bottom-right{right:20px;bottom:20px;border-radius:999px}' +
  '.snc-teaser-bottom-left{left:20px;bottom:20px;border-radius:999px}' +
  '@media (prefers-reduced-motion:reduce){.snc-teaser{transition:none}}';

// A bar carries its email form on one line; the labels stay for screen readers only.
const BAR_CSS =
  '.snc-banner .snc-form{flex-direction:row;flex-wrap:wrap;align-items:center;gap:8px;flex:1 1 320px;justify-content:center}' +
  '.snc-banner .snc-form>div:not(.snc-form-hp){flex:1 1 150px;max-width:240px}' +
  '.snc-banner .snc-form label:not(.snc-form-consent){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
  '.snc-banner .snc-form-error{flex-basis:100%;text-align:center;color:inherit}' +
  '.snc-banner .snc-form-consent{flex-basis:100%;justify-content:center}' +
  '.snc-banner .snc-coupon{margin:0}';

const CONTAINED_CSS =
  '.snc-contained{position:relative;overflow:hidden;transform:translateZ(0)}' +
  '.snc-contained .snc-overlay{position:absolute;z-index:1}' +
  '.snc-contained .snc-modal{max-height:92%}' +
  '.snc-contained .snc-banner{position:absolute;z-index:1}' +
  '.snc-contained .snc-teaser{position:absolute;z-index:1}';

const STYLE_ID = 'snc-styles';

export const POPUP_CSS = BASE_CSS + FORM_CSS + WHEEL_CSS + STEPS_CSS + COUNTDOWN_CSS + COUPON_CSS + TEASER_CSS + BAR_CSS + CONTAINED_CSS;

/** Inject the stylesheet if this document does not have it yet. Safe to call repeatedly. */
export const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = POPUP_CSS;
  document.head.appendChild(s);
};
