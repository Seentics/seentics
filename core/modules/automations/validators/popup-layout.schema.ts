import { z } from "zod";

/**
 * The popup types a `show_modal` / `show_banner` action can take, beyond a plain message.
 *
 * Validated strictly, like the lead form, because these are what the visitor's browser
 * later renders and — for the wheel and coupons — what the server later pays out from.
 * A malformed segment list should fail when the owner saves it, not produce a wheel that
 * cannot land or a prize that cannot be chosen.
 *
 * Configuration for a layout other than the selected one is tolerated but ignored (see
 * `lib/popup-rewards.ts` and the tracker): switching layouts in the builder should not
 * throw away what the owner typed.
 */

export const POPUP_LAYOUTS = ["modal", "spin_wheel", "multi_step", "countdown"] as const;
export type PopupLayout = (typeof POPUP_LAYOUTS)[number];

const colorToken = z.string().max(40).regex(/^[#a-zA-Z0-9(),.%\s-]*$/, "Use a CSS colour like #2563eb");

/** A coupon code is shown to the visitor, so keep it to what a checkout field accepts. */
const couponCode = z.string().trim().max(64).regex(/^[A-Za-z0-9 _.\-]*$/, "Letters, digits, spaces and - _ . only");

export const wheelSegmentSchema = z.object({
  label: z.string().trim().min(1).max(40),
  /** Relative chance. 0 keeps a slice on the wheel that can never win. */
  weight: z.number().int().min(0).max(1000).default(1),
  /** Empty means a no-prize slice ("Try again"). Redacted from the page; see `redactRewards`. */
  coupon_code: couponCode.default(""),
  color: colorToken.optional(),
});

export const wheelSchema = z
  .object({
    segments: z.array(wheelSegmentSchema).min(2).max(12),
    /** Shown on the submit button, e.g. "Spin to win". */
    spin_text: z.string().max(40).default("Spin to win"),
  })
  .refine((w) => w.segments.some((s) => s.weight > 0), {
    message: "At least one slice needs a weight above 0",
    path: ["segments"],
  });

const stepOptionSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(60),
});

export const stepSchema = z.object({
  /** The answer is stored under this name, like a form field. */
  name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/i, "Names are letters, digits and underscores"),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(300).default(""),
  options: z.array(stepOptionSchema).min(2).max(6),
});

/** Questions shown before the email step. */
export const stepsSchema = z
  .array(stepSchema)
  .min(1)
  .max(5)
  .refine((steps) => new Set(steps.map((s) => s.name.toLowerCase())).size === steps.length, {
    message: "Each step needs its own name",
  });

export const countdownSchema = z
  .object({
    /** `fixed` ends at `ends_at` for everyone; `evergreen` gives each visitor their own timer. */
    mode: z.enum(["fixed", "evergreen"]).default("evergreen"),
    ends_at: z.string().datetime({ offset: true }).optional(),
    duration_minutes: z.number().int().min(1).max(60 * 24 * 30).default(30),
    label: z.string().max(80).default(""),
    expired_text: z.string().max(120).default("This offer has ended."),
    /** Close the popup when time runs out instead of showing `expired_text`. */
    hide_on_expire: z.boolean().default(false),
  })
  .refine((c) => c.mode !== "fixed" || !!c.ends_at, { message: "A fixed countdown needs an end date", path: ["ends_at"] });

export const teaserSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Get 10% off"),
  position: z.enum(["left", "right", "bottom-left", "bottom-right"]).default("right"),
  /** Bring the tab back after the visitor closes the full popup. */
  reopen: z.boolean().default(true),
});

export const couponSchema = z.object({
  code: couponCode.min(1),
  description: z.string().max(160).default(""),
});

export type WheelConfig = z.infer<typeof wheelSchema>;
export type CountdownConfig = z.infer<typeof countdownSchema>;
