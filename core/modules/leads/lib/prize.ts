import type { WheelSegment } from "../../automations/interfaces";
import type { LeadFields, Prize } from "../interfaces";

/**
 * Answers whose key starts with this are discarded: the prize lives in its own column, and a
 * form field that looked like one would show a made-up prize in the submissions list.
 */
const RESERVED_PREFIX = "prize";

/**
 * Choose a slice, weighted.
 *
 * `random` is injected for tests; it must return a value in [0, 1). A slice with weight 0
 * never wins. The id is the slice's position, which is what the tracker has to find it by
 * (the page is sent labels and weights but no codes — see `redactRewards`).
 */
export function pickWheelPrize(segments: readonly WheelSegment[], random: () => number = Math.random): Prize | null {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.weight), 0);
  if (total <= 0) return null;

  let roll = random() * total;
  for (let i = 0; i < segments.length; i++) {
    const weight = Math.max(0, segments[i]!.weight);
    if (weight === 0) continue;
    if (roll < weight) return segmentPrize(segments[i]!, i);
    roll -= weight;
  }
  // Floating-point residue: land on the last slice that can win.
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]!.weight > 0) return segmentPrize(segments[i]!, i);
  }
  return null;
}

const segmentPrize = (s: WheelSegment, index: number): Prize => ({
  id: String(index),
  label: s.label,
  coupon_code: s.coupon_code || null,
});

/** A coupon that is not a wheel prize: one fixed reward behind the email. */
export const couponPrize = (coupon: { code: string; description: string }): Prize => ({
  id: "coupon",
  label: coupon.description || "Your coupon",
  coupon_code: coupon.code,
});

/** Drop anything the browser sent that looks like a prize. */
export function withoutPrizeFields(fields: LeadFields): LeadFields {
  const out: LeadFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!key.toLowerCase().startsWith(RESERVED_PREFIX)) out[key] = value;
  }
  return out;
}
