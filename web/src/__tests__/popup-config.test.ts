import { describe, expect, it } from 'vitest';
import {
  MAX_OPTIONS, MAX_SEGMENTS, MAX_STEPS, addOption, addSegment, addStep, applyLayout, defaultCountdown, defaultSteps,
  defaultWheel, fromLocalInput, layoutOf, previewPrize, removeOption, removeSegment, removeStep, slugify, toLocalInput,
  updateOptionLabel, updateSegment, validateCountdown, validatePopup, validateSteps, validateWheel, winChance,
  type PopupAction,
} from '@/lib/popup-config';

const modal = (extra: Partial<PopupAction> = {}): PopupAction => ({ type: 'show_modal', ...extra });

describe('applyLayout', () => {
  it('adds the wheel and the email form a spin-wheel cannot work without', () => {
    const a = applyLayout(modal(), 'spin_wheel');
    expect(a.layout).toBe('spin_wheel');
    expect(a.wheel?.segments.length).toBeGreaterThanOrEqual(2);
    expect(a.form).toBeDefined();
    expect(validatePopup(a)).toEqual([]);
  });

  it('adds steps and a form for multi-step, and a timer for countdown', () => {
    const steps = applyLayout(modal(), 'multi_step');
    expect(steps.steps).toEqual(defaultSteps());
    expect(steps.form).toBeDefined();
    expect(applyLayout(modal(), 'countdown').countdown).toEqual(defaultCountdown());
  });

  it('keeps what was configured under another layout', () => {
    const wheel = { ...defaultWheel(), spin_text: 'Roll' };
    const back = applyLayout(applyLayout(modal({ wheel }), 'multi_step'), 'spin_wheel');
    expect(back.wheel?.spin_text).toBe('Roll');
  });

  it('treats an action saved before layouts as a simple popup', () => {
    expect(layoutOf(modal())).toBe('modal');
  });
});

describe('wheel editing', () => {
  it('adds slices up to the cap and removes down to two', () => {
    let w = defaultWheel();
    for (let i = 0; i < 20; i++) w = addSegment(w);
    expect(w.segments).toHaveLength(MAX_SEGMENTS);
    for (let i = 0; i < 20; i++) w = removeSegment(w, 0);
    expect(w.segments).toHaveLength(2);
  });

  it('updates one slice', () => {
    expect(updateSegment(defaultWheel(), 1, { weight: 9 }).segments[1]!.weight).toBe(9);
  });

  it('reports each slice’s chance, and zero when nothing can win', () => {
    const w = { spin_text: '', segments: [{ label: 'a', weight: 1, coupon_code: '' }, { label: 'b', weight: 3, coupon_code: '' }] };
    expect([winChance(w, 0), winChance(w, 1)]).toEqual([25, 75]);
    expect(winChance(updateSegment(updateSegment(w, 0, { weight: 0 }), 1, { weight: 0 }), 0)).toBe(0);
  });

  it('validates labels, codes and winnability', () => {
    expect(validateWheel(defaultWheel())).toEqual([]);
    const dead = { spin_text: '', segments: [{ label: 'a', weight: 0, coupon_code: '' }, { label: 'b', weight: 0, coupon_code: '' }] };
    expect(validateWheel(dead).join(' ')).toMatch(/nobody can win/);
    expect(validateWheel(updateSegment(defaultWheel(), 0, { coupon_code: '<x>' })).join(' ')).toMatch(/coupon codes/);
    expect(validateWheel(updateSegment(defaultWheel(), 0, { label: ' ' })).join(' ')).toMatch(/needs a label/);
  });
});

describe('step editing', () => {
  it('adds uniquely named questions up to the cap, and keeps at least one', () => {
    let steps = defaultSteps();
    for (let i = 0; i < 10; i++) steps = addStep(steps);
    expect(steps).toHaveLength(MAX_STEPS);
    expect(new Set(steps.map((s) => s.name)).size).toBe(MAX_STEPS);
    expect(validateSteps(steps)).toEqual([]);
    for (let i = 0; i < 10; i++) steps = removeStep(steps, 0);
    expect(steps).toHaveLength(1);
  });

  it('bounds the answers of a question', () => {
    let step = defaultSteps()[0]!;
    for (let i = 0; i < 10; i++) step = addOption(step);
    expect(step.options).toHaveLength(MAX_OPTIONS);
    for (let i = 0; i < 10; i++) step = removeOption(step, 0);
    expect(step.options).toHaveLength(2);
  });

  it('keeps an answer’s stored value in step with its label until it is set apart', () => {
    let step = defaultSteps()[0]!;
    step = updateOptionLabel(step, 0, 'Just looking!');
    expect(step.options[0]!.value).toBe('just_looking');
    const custom = { ...step, options: [{ label: 'Pro', value: 'plan_pro' }, step.options[1]!] };
    expect(updateOptionLabel(custom, 0, 'Professional').options[0]!.value).toBe('plan_pro');
    expect(slugify('Ready to buy!')).toBe('ready_to_buy');
  });

  it('rejects duplicate names, bad names and empty answers', () => {
    const [a] = defaultSteps();
    expect(validateSteps([a!, a!]).join(' ')).toMatch(/Two questions/);
    expect(validateSteps([{ ...a!, name: '1bad' }]).join(' ')).toMatch(/letters, digits/);
    expect(validateSteps([{ ...a!, options: [{ label: '', value: 'x' }, a!.options[1]!] }]).join(' ')).toMatch(/empty answer/);
  });
});

describe('countdown', () => {
  const now = Date.parse('2030-06-01T00:00:00Z');
  it('accepts an evergreen timer and a future fixed one', () => {
    expect(validateCountdown(defaultCountdown(), now)).toEqual([]);
    expect(validateCountdown({ ...defaultCountdown(), mode: 'fixed', ends_at: '2030-07-01T00:00:00Z' }, now)).toEqual([]);
  });
  it('asks for a date when fixed, and warns about a past one', () => {
    expect(validateCountdown({ ...defaultCountdown(), mode: 'fixed' }, now).join()).toMatch(/Choose when/);
    expect(validateCountdown({ ...defaultCountdown(), mode: 'fixed', ends_at: '2030-01-01T00:00:00Z' }, now).join()).toMatch(/already passed/);
  });
  it('converts between the date input and ISO', () => {
    const iso = fromLocalInput('2030-07-01T09:30');
    expect(iso).toBeDefined();
    expect(toLocalInput(iso)).toBe('2030-07-01T09:30');
    expect(fromLocalInput('')).toBeUndefined();
    expect(toLocalInput('nope')).toBe('');
  });
});

describe('validatePopup and previewPrize', () => {
  it('flags a wheel without a form and a coupon without a code', () => {
    expect(validatePopup(modal({ layout: 'spin_wheel', wheel: defaultWheel() })).join(' ')).toMatch(/needs the email form/);
    expect(validatePopup(modal({ coupon: { code: ' ', description: '' } })).join(' ')).toMatch(/needs a code/);
  });

  it('previews a weighted wheel prize and a coupon behind the form', () => {
    const wheel = { spin_text: '', segments: [{ label: 'a', weight: 1, coupon_code: 'A' }, { label: 'b', weight: 0, coupon_code: 'B' }] };
    expect(previewPrize(modal({ layout: 'spin_wheel', wheel }), () => 0.99)).toEqual({ id: '0', label: 'a', coupon_code: 'A' });
    expect(previewPrize(applyLayout(modal({ form: undefined, coupon: { code: 'HI', description: 'd' } }), 'modal'))).toBeNull();
    const gated = modal({ form: { fields: [], submit_text: '', success_message: '', consent_required: true }, coupon: { code: 'HI', description: 'd' } });
    expect(previewPrize(gated)).toEqual({ id: 'coupon', label: 'd', coupon_code: 'HI' });
  });
});
