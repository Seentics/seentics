// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRemaining, remainingMs } from '../../public/trackers/popup-countdown.js';
import { createPopupRenderer, wheelIndexOf } from '../../public/trackers/popup-render.js';
import { progressLabel } from '../../public/trackers/popup-steps.js';
import { buildWheel, wheelGradient, wheelRotation } from '../../public/trackers/popup-wheel.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  document.body.replaceChildren();
  document.head.querySelector('#snc-styles')?.remove();
  localStorage.clear();
  // Reduced motion: the wheel snaps to its result instead of waiting on a CSS transition.
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('wheel maths', () => {
  it('turns whole revolutions minus the slice centre', () => {
    // Four slices of 90°: slice 0's centre is at 45°, so the wheel turns back to put it under the pointer.
    expect(wheelRotation(0, 4, 5)).toBe(1800 - 45);
    expect(wheelRotation(2, 4, 5)).toBe(1800 - 225);
  });

  it('stays inside the slice when jittered', () => {
    for (const j of [-0.4, 0.4]) {
      const r = wheelRotation(1, 6, 5, j);
      const under = (((-r) % 360) + 360) % 360; // disc angle under the pointer
      expect(under).toBeGreaterThan(60);
      expect(under).toBeLessThan(120);
    }
  });

  it('draws one gradient stop per slice and refuses a hostile colour', () => {
    const g = wheelGradient([{ label: 'a', color: '#fff' }, { label: 'b', color: 'red;background:url(x)' }]);
    expect(g.startsWith('conic-gradient(')).toBe(true);
    expect(g).not.toContain('url(');
  });

  it('only accepts a prize id that is a real slice', () => {
    expect(wheelIndexOf({ id: '1' }, 3)).toBe(1);
    expect(wheelIndexOf({ id: '3' }, 3)).toBe(-1);
    expect(wheelIndexOf({ id: 'coupon' }, 3)).toBe(-1);
    expect(wheelIndexOf(null, 3)).toBe(-1);
  });

  it('writes labels as text, and spins once', async () => {
    const wheel = buildWheel([{ label: '<b>x</b>' }, { label: 'y' }]);
    document.body.append(wheel.el);
    expect(wheel.el.querySelector('b')).toBeNull();
    expect(wheel.el.getAttribute('aria-label')).toContain('2 slices');
    await wheel.spinTo(1);
    const first = (wheel.el.querySelector('.snc-wheel') as HTMLElement).style.transform;
    await wheel.spinTo(0);
    expect((wheel.el.querySelector('.snc-wheel') as HTMLElement).style.transform).toBe(first);
  });
});

describe('countdown maths', () => {
  it('counts a fixed timer to its end date and never goes negative', () => {
    const cfg = { mode: 'fixed', ends_at: '2030-01-01T00:00:10Z' };
    const end = Date.parse(cfg.ends_at);
    expect(remainingMs(cfg, end - 4000, 0)).toBe(4000);
    expect(remainingMs(cfg, end + 5000, 0)).toBe(0);
  });

  it('counts an evergreen timer from the visitor’s own start', () => {
    expect(remainingMs({ mode: 'evergreen', duration_minutes: 2 }, 1_000_000 + 30_000, 1_000_000)).toBe(90_000);
  });

  it('is expired rather than NaN for an unusable date', () => {
    expect(remainingMs({ mode: 'fixed', ends_at: 'soon' }, Date.now(), 0)).toBe(0);
  });

  it('formats clock and days', () => {
    expect(formatRemaining(3_723_000)).toBe('01:02:03');
    expect(formatRemaining(2 * 86_400_000 + 5_000)).toBe('2d 00:00:05');
    expect(formatRemaining(-5)).toBe('00:00:00');
  });

  it('labels progress including the email step', () => {
    expect(progressLabel(0, 2)).toBe('Step 1 of 3');
  });
});

const formCfg = { fields: [], submit_text: 'Go', success_message: 'Thanks!' };
const base = { automation_id: 'a1', variant: 'a' };

async function submitEmail(root: ParentNode, email = 'a@b.co') {
  const input = root.querySelector('input[name=email]') as HTMLInputElement;
  input.value = email;
  (input.closest('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
  await tick(); await tick(); await tick();
}

describe('spin wheel', () => {
  const wheelAction = {
    ...base, type: 'show_modal', layout: 'spin_wheel', title: 'Spin!',
    form: formCfg,
    wheel: { spin_text: 'Spin it', segments: [{ label: '10% off', weight: 1, coupon_code: '' }, { label: 'Try again', weight: 1, coupon_code: '' }] },
  };

  it('draws the wheel, relabels the button, and animates to the prize the server returns', async () => {
    const submit = vi.fn().mockResolvedValue({ prize: { id: '0', label: '10% off', coupon_code: 'SAVE10' } });
    createPopupRenderer({ submit }).renderModal(wheelAction);
    expect(document.querySelectorAll('.snc-wheel-label')).toHaveLength(2);
    expect(document.querySelector('button[type=submit]')?.textContent).toBe('Spin it');

    await submitEmail(document);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.snc-coupon-code')?.textContent).toBe('SAVE10');
    expect(document.querySelector('[role=status]')?.textContent).toContain('10% off');
  });

  it('shows a no-prize slice as plain text with no code', async () => {
    const submit = vi.fn().mockResolvedValue({ prize: { id: '1', label: 'Try again', coupon_code: null } });
    createPopupRenderer({ submit }).renderModal(wheelAction);
    await submitEmail(document);
    expect(document.querySelector('.snc-coupon')).toBeNull();
    expect(document.querySelector('[role=status]')?.textContent).toBe('Try again');
  });

  it('thanks the visitor without spinning when the server sends no prize', async () => {
    createPopupRenderer({ submit: vi.fn().mockResolvedValue({ prize: null }) }).renderModal(wheelAction);
    await submitEmail(document);
    expect(document.querySelector('[role=status]')?.textContent).toBe('Thanks!');
  });

  it('never holds a coupon code before the server sends one', () => {
    createPopupRenderer({ submit: vi.fn() }).renderModal(wheelAction);
    expect(document.body.textContent).not.toContain('SAVE10');
  });
});

describe('multi-step', () => {
  const action = {
    ...base, type: 'show_modal', layout: 'multi_step', title: 'Find your plan', form: formCfg,
    steps: [
      { name: 'goal', title: 'Your goal?', body: '', options: [{ label: 'Sales', value: 'sales' }, { label: 'Support', value: 'support' }] },
      { name: 'size', title: 'Team size?', body: '', options: [{ label: 'Solo', value: 'solo' }, { label: 'Team', value: 'team' }] },
    ],
  };

  it('asks each question, then the email, and sends the answers with the lead', async () => {
    const submit = vi.fn().mockResolvedValue({ prize: null });
    createPopupRenderer({ submit }).renderModal(action);
    expect(document.querySelector('.snc-step-title')?.textContent).toBe('Your goal?');
    expect(document.querySelector('.snc-step-progress')?.textContent).toBe('Step 1 of 3');

    (document.querySelectorAll('.snc-step-option')[1] as HTMLElement).click();
    expect(document.querySelector('.snc-step-title')?.textContent).toBe('Team size?');

    (document.querySelector('.snc-step-back') as HTMLElement).click();
    expect(document.querySelector('.snc-step-title')?.textContent).toBe('Your goal?');
    (document.querySelectorAll('.snc-step-option')[0] as HTMLElement).click();
    (document.querySelectorAll('.snc-step-option')[1] as HTMLElement).click();

    expect(document.querySelector('input[name=email]')).not.toBeNull();
    expect(document.querySelector('.snc-step-progress')?.textContent).toBe('Step 3 of 3');
    await submitEmail(document);
    expect(submit.mock.calls[0]![1].fields).toEqual({ goal: 'sales', size: 'team' });
  });
});

describe('teaser, coupon and bar', () => {
  it('shows only a tab until it is clicked, and brings it back when the popup is closed', () => {
    createPopupRenderer({}).renderModal({ ...base, type: 'show_modal', title: 'Hi', teaser: { label: 'Get 10% off', position: 'right', reopen: true } });
    expect(document.querySelector('.snc-modal')).toBeNull();
    const tab = document.querySelector('.snc-teaser') as HTMLElement;
    expect(tab.textContent).toBe('Get 10% off');

    tab.click();
    expect(document.querySelector('.snc-teaser')).toBeNull();
    expect(document.querySelector('.snc-modal')).not.toBeNull();

    (document.querySelector('.snc-modal-close') as HTMLElement).click();
    expect(document.querySelector('.snc-modal')).toBeNull();
    expect(document.querySelector('.snc-teaser')).not.toBeNull();
  });

  it('shows a coupon behind the form only after the server hands it out', async () => {
    const action = { ...base, type: 'show_modal', form: formCfg, coupon: { code: '', description: 'Welcome gift' } };
    createPopupRenderer({ submit: vi.fn().mockResolvedValue({ prize: { id: 'coupon', label: 'Welcome gift', coupon_code: 'WELCOME' } }) }).renderModal(action);
    expect(document.querySelector('.snc-coupon')).toBeNull();
    await submitEmail(document);
    expect(document.querySelector('.snc-coupon-code')?.textContent).toBe('WELCOME');
  });

  it('shows a bare coupon straight away', () => {
    createPopupRenderer({}).renderModal({ ...base, type: 'show_modal', title: 'Gift', coupon: { code: 'HELLO', description: 'Ten off' } });
    expect(document.querySelector('.snc-coupon-code')?.textContent).toBe('HELLO');
  });

  it('renders a sticky bar with an inline email form and a countdown', async () => {
    const submit = vi.fn().mockResolvedValue({ prize: null });
    createPopupRenderer({ submit }).renderBanner({ ...base, type: 'show_banner', message: 'Flash sale', position: 'bottom', form: formCfg, countdown: { mode: 'evergreen', duration_minutes: 10, expired_text: 'Over', hide_on_expire: false } });
    const bar = document.querySelector('.snc-banner') as HTMLElement;
    expect(bar.classList.contains('bottom')).toBe(true);
    expect(bar.querySelector('.snc-countdown-clock')?.textContent).toBe('00:10:00');
    await submitEmail(bar);
    expect(submit).toHaveBeenCalled();
    expect(bar.querySelector('[role=status]')?.textContent).toBe('Thanks!');
  });

  it('starts an evergreen timer once per visitor and survives a reload', () => {
    const action = { ...base, type: 'show_banner', message: 'Sale', countdown: { mode: 'evergreen', duration_minutes: 5 } };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    createPopupRenderer({}).renderBanner(action);
    vi.setSystemTime(new Date('2030-01-01T00:01:00Z'));
    document.body.replaceChildren();
    createPopupRenderer({}).renderBanner(action);
    expect(document.querySelector('.snc-countdown-clock')?.textContent).toBe('00:04:00');
  });

  it('closes a popup whose timer runs out when asked to', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    createPopupRenderer({}).renderModal({ ...base, type: 'show_modal', title: 'x', countdown: { mode: 'fixed', ends_at: '2030-01-01T00:00:02Z', hide_on_expire: true } });
    expect(document.querySelector('.snc-modal')).not.toBeNull();
    vi.advanceTimersByTime(3000);
    expect(document.querySelector('.snc-modal')).toBeNull();
  });

  it('shows the expired text instead when it should not hide', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    createPopupRenderer({}).renderBanner({ ...base, type: 'show_banner', message: 'x', countdown: { mode: 'fixed', ends_at: '2030-01-01T00:00:01Z', expired_text: 'Sale over' } });
    vi.advanceTimersByTime(2000);
    expect(document.querySelector('.snc-countdown-clock')?.textContent).toBe('Sale over');
  });
});

describe('safety and behaviour', () => {
  it('never turns owner text into markup', () => {
    createPopupRenderer({}).renderModal({ ...base, type: 'show_modal', title: '<img src=x onerror=alert(1)>', body: '<b>hi</b>', button_text: '<i>go</i>', button_url: 'javascript:alert(1)' });
    expect(document.querySelector('.snc-modal img')).toBeNull();
    expect(document.querySelector('.snc-modal b')).toBeNull();
    const link = document.querySelector('.snc-modal-btn') as HTMLAnchorElement;
    expect(link.textContent).toBe('<i>go</i>');
    expect(link.getAttribute('href')).toBe('#');
  });

  it('is an accessible dialog that closes on Escape and returns focus', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    createPopupRenderer({}).renderModal({ ...base, type: 'show_modal', title: 'Hello' });
    const modal = document.querySelector('.snc-modal') as HTMLElement;
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.snc-modal')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('renders into a container for the preview, anchored to it and heard only there', () => {
    const box = document.createElement('div');
    document.body.append(box);
    const popups = createPopupRenderer({ root: box });
    popups.renderModal({ ...base, type: 'show_modal', title: 'Preview' });
    expect(box.classList.contains('snc-contained')).toBe(true);
    expect(box.querySelector('.snc-overlay')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(box.querySelector('.snc-modal')).not.toBeNull();
    popups.destroy();
    expect(box.querySelector('.snc-overlay')).toBeNull();
  });

  it('keeps the existing plain modal and banner working', () => {
    const popups = createPopupRenderer({});
    popups.renderModal({ ...base, type: 'show_modal', title: 'T', body: 'B', button_text: 'Go', button_url: '/signup', background_color: '#111', button_color: '#f00' });
    const link = document.querySelector('.snc-modal-btn') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/signup');
    expect(link.style.background).toBe('rgb(255, 0, 0)');
    popups.renderBanner({ ...base, type: 'show_banner', message: 'Hello', button_text: 'More', button_url: 'https://x.test' });
    expect(document.querySelector('.snc-banner')?.textContent).toContain('Hello');
  });
});
