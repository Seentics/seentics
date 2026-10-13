import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/features/automations/templates';
import { validatePopup, type PopupAction } from '@/lib/popup-config';

const POPUP_IDS = ['spin-to-win', 'countdown-sale-bar', 'multi-step-quiz', 'sticky-email-bar', 'teaser-tab-offer', 'coupon-reveal'];

const actionsOf = (t: (typeof TEMPLATES)[number]) =>
  (t.definition.graph.nodes as { kind: string; action?: PopupAction }[]).filter((n) => n.kind === 'action').map((n) => n.action!);

describe('starter templates', () => {
  it('have unique ids', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it('include one template for each popup type', () => {
    for (const id of POPUP_IDS) expect(TEMPLATES.some((t) => t.id === id), id).toBe(true);
  });

  it('carry popup configuration the builder and the server both accept', () => {
    for (const id of POPUP_IDS) {
      const template = TEMPLATES.find((t) => t.id === id)!;
      for (const action of actionsOf(template)) expect(validatePopup(action), id).toEqual([]);
    }
  });

  it('give the wheel template at least one winnable, coupon-bearing slice and one no-prize slice', () => {
    const wheel = actionsOf(TEMPLATES.find((t) => t.id === 'spin-to-win')!)[0]!.wheel!;
    expect(wheel.segments.some((s) => s.weight > 0 && s.coupon_code)).toBe(true);
    expect(wheel.segments.some((s) => !s.coupon_code)).toBe(true);
  });
});
