import type { WheelSegment } from "../../automations/interfaces";
import type { LeadFields, Prize } from "../interfaces";

/**
 * Keys the server writes into a submission's answers to record a prize.
 *
 * Reserved: anything the browser sends under a `prize` prefix is discarded, so a script
 * cannot claim a prize by posting one (see `withoutPrizeFields`).
 */
const PRIZE_ID = "prize_id";
const PRIZE_LABEL = "prize_label";
const PRIZE_CODE = "prize_code";
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

export function prizeToFields(prize: Prize): LeadFields {
  return {
    [PRIZE_ID]: prize.id,
    [PRIZE_LABEL]: prize.label,
    ...(prize.coupon_code ? { [PRIZE_CODE]: prize.coupon_code } : {}),
  };
}

/** The prize recorded on a stored submission, if it has one. */
export function prizeFromFields(fields: unknown): Prize | null {
  if (!fields || typeof fields !== "object") return null;
  const f = fields as Record<string, unknown>;
  if (typeof f[PRIZE_ID] !== "string" || typeof f[PRIZE_LABEL] !== "string") return null;
  return {
    id: f[PRIZE_ID] as string,
    label: f[PRIZE_LABEL] as string,
    coupon_code: typeof f[PRIZE_CODE] === "string" ? (f[PRIZE_CODE] as string) : null,
  };
}

/** Drop anything the browser sent that looks like a prize. */
export function withoutPrizeFields(fields: LeadFields): LeadFields {
  const out: LeadFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!key.toLowerCase().startsWith(RESERVED_PREFIX)) out[key] = value;
  }
  return out;
}
