/**
 * The coupon a visitor is shown: either a prize the server chose, or a fixed code the
 * owner put behind the email form.
 *
 * Everything is `textContent`. The code is copied with the async clipboard API where it
 * exists; where it does not (an insecure page, an old browser) the code stays selectable,
 * which is all a visitor needs to copy it by hand.
 */
import { el } from './popup-util.js';

export const couponNode = (prize) => {
  const wrap = el('div', { className: 'snc-coupon' });
  wrap.setAttribute('data-snc', 'coupon');

  if (prize.label) wrap.append(el('p', { className: 'snc-coupon-label', textContent: prize.label }));
  if (!prize.coupon_code) return wrap;

  const code = el('code', { className: 'snc-coupon-code', textContent: prize.coupon_code });
  const copy = el('button', { type: 'button', className: 'snc-coupon-copy', textContent: 'Copy' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prize.coupon_code);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Press Ctrl+C';
      const range = document.createRange();
      range.selectNodeContents(code);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  wrap.append(el('div', { className: 'snc-coupon-row' }, [code, copy]));
  return wrap;
};
