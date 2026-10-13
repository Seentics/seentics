/**
 * The popup types a modal or bar can take, and the edits the builder makes to them.
 *
 * Pure functions over plain data, kept out of the components so the rules — a wheel has
 * two to twelve slices and at least one that can win, a step has two to six answers —
 * are testable without rendering anything. Shapes mirror `popup-layout.schema.ts` in core,
 * which is what actually enforces them on save.
 */
import { defaultLeadForm, type LeadForm } from './lead-form';

export type PopupLayout = 'modal' | 'spin_wheel' | 'multi_step' | 'countdown';

export const LAYOUT_OPTIONS: { value: PopupLayout; label: string; hint: string }[] = [
  { value: 'modal', label: 'Simple popup', hint: 'A message with a button or an email form.' },
  { value: 'spin_wheel', label: 'Spin to win', hint: 'A prize wheel unlocked by an email. The prize is chosen on the server.' },
  { value: 'multi_step', label: 'Multi-step', hint: 'A few one-tap questions, then the email.' },
  { value: 'countdown', label: 'Countdown', hint: 'A timer to create urgency.' },
];

export type WheelSegment = { label: string; weight: number; coupon_code: string; color?: string };
export type WheelConfig = { segments: WheelSegment[]; spin_text: string };

export type StepOption = { label: string; value: string };
export type PopupStep = { name: string; title: string; body: string; options: StepOption[] };

export type CountdownConfig = {
  mode: 'fixed' | 'evergreen';
  ends_at?: string;
  duration_minutes: number;
  label: string;
  expired_text: string;
  hide_on_expire: boolean;
};

export type TeaserConfig = {
  label: string;
  position: 'left' | 'right' | 'bottom-left' | 'bottom-right';
  reopen: boolean;
};

export type CouponConfig = { code: string; description: string };

/** The part of an action these helpers read and write; the rest passes through untouched. */
export type PopupAction = {
  type: string;
  layout?: PopupLayout;
  form?: LeadForm;
  wheel?: WheelConfig;
  steps?: PopupStep[];
  countdown?: CountdownConfig;
  teaser?: TeaserConfig;
  coupon?: CouponConfig;
  [key: string]: unknown;
};

export const MIN_SEGMENTS = 2;
export const MAX_SEGMENTS = 12;
export const MAX_STEPS = 5;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const defaultWheel = (): WheelConfig => ({
  spin_text: 'Spin to win',
  segments: [
    { label: '10% off', weight: 3, coupon_code: 'SPIN10' },
    { label: 'Free shipping', weight: 2, coupon_code: 'SHIPFREE' },
    { label: '20% off', weight: 1, coupon_code: 'SPIN20' },
    { label: 'Try again', weight: 4, coupon_code: '' },
  ],
});

export const defaultSteps = (): PopupStep[] => [
  {
    name: 'goal',
    title: 'What brings you here?',
    body: '',
    options: [
      { label: 'Just browsing', value: 'just_browsing' },
      { label: 'Ready to buy', value: 'ready_to_buy' },
    ],
  },
];

export const defaultCountdown = (): CountdownConfig => ({
  mode: 'evergreen',
  duration_minutes: 30,
  label: 'Offer ends in',
  expired_text: 'This offer has ended.',
  hide_on_expire: false,
});

export const defaultTeaser = (): TeaserConfig => ({ label: 'Get 10% off', position: 'right', reopen: true });

export const defaultCoupon = (): CouponConfig => ({ code: 'WELCOME10', description: 'Your 10% off code' });

// ─── Layout ────────────────────────────────────────────────────────────────────

/**
 * Switch layout, adding whatever the new one cannot work without.
 *
 * Configuration for the layout being left is kept, not deleted: flipping to "Multi-step"
 * and back should not throw away a wheel the owner spent ten minutes on. Core and the
 * tracker both ignore config that does not belong to the selected layout.
 */
export function applyLayout<T extends PopupAction>(action: T, layout: PopupLayout): T {
  const next: T = { ...action, layout };
  if (layout === 'spin_wheel') {
    next.wheel = action.wheel ?? defaultWheel();
    next.form = action.form ?? defaultLeadForm();
  } else if (layout === 'multi_step') {
    next.steps = action.steps ?? defaultSteps();
    next.form = action.form ?? defaultLeadForm();
  } else if (layout === 'countdown') {
    next.countdown = action.countdown ?? defaultCountdown();
  }
  return next;
}

/** The selected layout; an action saved before layouts existed is a simple popup. */
export const layoutOf = (action: PopupAction): PopupLayout => action.layout ?? 'modal';

// ─── Wheel ─────────────────────────────────────────────────────────────────────

export function addSegment(wheel: WheelConfig): WheelConfig {
  if (wheel.segments.length >= MAX_SEGMENTS) return wheel;
  return { ...wheel, segments: [...wheel.segments, { label: `Prize ${wheel.segments.length + 1}`, weight: 1, coupon_code: '' }] };
}

export function updateSegment(wheel: WheelConfig, index: number, patch: Partial<WheelSegment>): WheelConfig {
  return { ...wheel, segments: wheel.segments.map((s, i) => (i === index ? { ...s, ...patch } : s)) };
}

export function removeSegment(wheel: WheelConfig, index: number): WheelConfig {
  if (wheel.segments.length <= MIN_SEGMENTS) return wheel;
  return { ...wheel, segments: wheel.segments.filter((_, i) => i !== index) };
}

/** A slice's chance of winning, as a whole percentage. 0 when nothing can win. */
export function winChance(wheel: WheelConfig, index: number): number {
  const total = wheel.segments.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
  return total > 0 ? Math.round((Math.max(0, wheel.segments[index]?.weight ?? 0) / total) * 100) : 0;
}

const COUPON_CODE = /^[A-Za-z0-9 _.\-]*$/;

export function validateWheel(wheel: WheelConfig): string[] {
  const problems: string[] = [];
  if (wheel.segments.length < MIN_SEGMENTS) problems.push(`A wheel needs at least ${MIN_SEGMENTS} slices.`);
  if (!wheel.segments.some((s) => s.weight > 0)) problems.push('At least one slice needs a weight above 0, or nobody can win.');
  wheel.segments.forEach((s, i) => {
    if (!s.label.trim()) problems.push(`Slice ${i + 1} needs a label.`);
    if (!COUPON_CODE.test(s.coupon_code)) problems.push(`Slice ${i + 1}: coupon codes use letters, digits, spaces and - _ . only.`);
  });
  return problems;
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

/** `Ready to buy!` → `ready_to_buy`: a value that is safe to store and filter on. */
export const slugify = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

export function addStep(steps: PopupStep[]): PopupStep[] {
  if (steps.length >= MAX_STEPS) return steps;
  const used = new Set(steps.map((s) => s.name));
  let n = steps.length + 1;
  while (used.has(`question_${n}`)) n++;
  return [...steps, {
    name: `question_${n}`, title: 'New question', body: '',
    options: [{ label: 'Option A', value: 'option_a' }, { label: 'Option B', value: 'option_b' }],
  }];
}

export const updateStep = (steps: PopupStep[], index: number, patch: Partial<PopupStep>): PopupStep[] =>
  steps.map((s, i) => (i === index ? { ...s, ...patch } : s));

export const removeStep = (steps: PopupStep[], index: number): PopupStep[] =>
  steps.length <= 1 ? steps : steps.filter((_, i) => i !== index);

export function addOption(step: PopupStep): PopupStep {
  if (step.options.length >= MAX_OPTIONS) return step;
  const n = step.options.length + 1;
  return { ...step, options: [...step.options, { label: `Option ${n}`, value: `option_${n}` }] };
}

/** Editing an option's label keeps its value in step, unless the owner set the value apart. */
export function updateOptionLabel(step: PopupStep, index: number, label: string): PopupStep {
  return {
    ...step,
    options: step.options.map((o, i) => {
      if (i !== index) return o;
      const followed = o.value === slugify(o.label) || o.value === '';
      return { label, value: followed ? slugify(label) || o.value : o.value };
    }),
  };
}

export function removeOption(step: PopupStep, index: number): PopupStep {
  if (step.options.length <= MIN_OPTIONS) return step;
  return { ...step, options: step.options.filter((_, i) => i !== index) };
}

const STEP_NAME = /^[a-z][a-z0-9_]{0,39}$/i;

export function validateSteps(steps: PopupStep[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  steps.forEach((s, i) => {
    if (!STEP_NAME.test(s.name)) problems.push(`Question ${i + 1}: the name must be letters, digits and underscores, starting with a letter.`);
    if (seen.has(s.name.toLowerCase())) problems.push(`Two questions are named "${s.name}".`);
    seen.add(s.name.toLowerCase());
    if (!s.title.trim()) problems.push(`Question ${i + 1} needs a title.`);
    if (s.options.some((o) => !o.label.trim() || !o.value.trim())) problems.push(`Question ${i + 1} has an empty answer.`);
  });
  return problems;
}

// ─── Countdown ─────────────────────────────────────────────────────────────────

export function validateCountdown(c: CountdownConfig, now: number = Date.now()): string[] {
  if (c.mode === 'evergreen') {
    return c.duration_minutes >= 1 ? [] : ['The countdown needs at least 1 minute.'];
  }
  if (!c.ends_at || Number.isNaN(Date.parse(c.ends_at))) return ['Choose when the countdown ends.'];
  return Date.parse(c.ends_at) <= now ? ['The end date has already passed, so visitors will see the expired message.'] : [];
}

/** `datetime-local` value ↔ the ISO string the API stores. Local time in, UTC out. */
export const toLocalInput = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (value: string): string | undefined => {
  const d = new Date(value);
  return value && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
};

// ─── Whole-action check, and the preview's stand-in for the server ────────────

/** Everything wrong with the popup-specific part of an action; empty when it can save. */
export function validatePopup(action: PopupAction): string[] {
  const problems: string[] = [];
  const layout = layoutOf(action);
  if (layout === 'spin_wheel') {
    if (!action.wheel) problems.push('A spin wheel needs its slices.');
    else problems.push(...validateWheel(action.wheel));
    if (!action.form) problems.push('A spin wheel needs the email form: the prize is chosen when it is submitted.');
  }
  if (layout === 'multi_step') {
    if (!action.steps?.length) problems.push('A multi-step popup needs at least one question.');
    else problems.push(...validateSteps(action.steps));
    if (!action.form) problems.push('A multi-step popup ends in the email form.');
  }
  if (action.countdown) problems.push(...validateCountdown(action.countdown));
  if (layout === 'countdown' && !action.countdown) problems.push('A countdown popup needs a countdown.');
  if (action.coupon && !action.coupon.code.trim()) problems.push('The coupon needs a code.');
  return problems;
}

export type PreviewPrize = { id: string; label: string; coupon_code: string | null };

/**
 * What the live preview hands back when its form is "submitted".
 *
 * The real server chooses a slice by weight and returns it with the code; the preview has
 * no server, so it makes the same weighted choice locally. Nothing is stored.
 */
export function previewPrize(action: PopupAction, random: () => number = Math.random): PreviewPrize | null {
  if (layoutOf(action) === 'spin_wheel' && action.wheel) {
    const winners = action.wheel.segments.map((s, i) => ({ s, i })).filter(({ s }) => s.weight > 0);
    const total = winners.reduce((sum, { s }) => sum + s.weight, 0);
    if (!total) return null;
    let roll = random() * total;
    for (const { s, i } of winners) {
      if (roll < s.weight) return { id: String(i), label: s.label, coupon_code: s.coupon_code || null };
      roll -= s.weight;
    }
    const last = winners[winners.length - 1]!;
    return { id: String(last.i), label: last.s.label, coupon_code: last.s.coupon_code || null };
  }
  if (action.form && action.coupon?.code) {
    return { id: 'coupon', label: action.coupon.description, coupon_code: action.coupon.code };
  }
  return null;
}
