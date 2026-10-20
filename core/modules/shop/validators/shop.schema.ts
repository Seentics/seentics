import { z } from "zod";
import { ORDER_STATUSES, RISK_LEVELS, TEMPLATES } from "../interfaces";
import { normalizeBdPhone } from "../lib/phone";
import { allowedUrl } from "../lib/html";
import { isValidSlug } from "../lib/slug";

/** Text a seller or buyer typed: trimmed, control characters out, length capped. */
const text = (max: number) =>
  z.string().transform((s) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim()).pipe(z.string().max(max));
const nullableText = (max: number) => text(max).nullable().transform((s) => (s ? s : null));

const slug = z.string().trim().toLowerCase().refine(isValidSlug, "slug must be 3-40 lowercase letters, digits or dashes, and not a reserved word");
const taka = z.number().int().min(0).max(10_000_000);
const httpsUrl = z.string().trim().max(500).refine((v) => {
  if (v.startsWith("/i/")) return true;
  try { return allowedUrl(new URL(v)); } catch { return false; }
}, "must be an https URL");
const bdPhone = z.string().max(20).transform((v, ctx) => {
  const n = normalizeBdPhone(v);
  if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_phone" });
  return n ?? "";
});

export const storeCreateSchema = z.object({ name: text(80).pipe(z.string().min(2)), slug });

export const storeUpdateSchema = z.object({
  slug,
  name: text(80).pipe(z.string().min(2)),
  phone: bdPhone.nullable(),
  whatsapp: bdPhone.nullable(),
  facebookUrl: httpsUrl.nullable(),
  logoUrl: httpsUrl.nullable(),
  deliveryInsideDhaka: z.number().int().min(0).max(5000),
  deliveryOutsideDhaka: z.number().int().min(0).max(5000),
  purchaseEventOn: z.enum(["placed", "confirmed", "delivered"]),
  autoBlockHighRisk: z.boolean(),
}).partial();

export const pageSchema = z.object({
  slug,
  template: z.enum(TEMPLATES).default("classic"),
  accent: z.string().trim().toLowerCase().regex(/^#[0-9a-f]{6}$/, "accent must be #rrggbb").default("#e11d48"),
  title: text(160).pipe(z.string().min(2)),
  productName: text(120).pipe(z.string().min(1)),
  price: taka.pipe(z.number().min(1)),
  comparePrice: taka.nullable().default(null),
  images: z.array(httpsUrl).max(8).default([]),
  description: text(5000).default(""),
  highlights: z.array(text(200).pipe(z.string().min(1))).max(8).default([]),
  faq: z.array(z.object({ q: text(200).pipe(z.string().min(1)), a: text(1000).pipe(z.string().min(1)) })).max(10).default([]),
  options: z.object({ label: text(40).pipe(z.string().min(1)), values: z.array(text(40).pipe(z.string().min(1))).min(1).max(20) }).nullable().default(null),
  maxQuantity: z.number().int().min(1).max(20).default(5),
  freeDelivery: z.boolean().default(false),
  thankYouMessage: nullableText(500).default(null),
});
export const pageUpdateSchema = pageSchema.partial();

export const orderListSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  risk: z.enum(RISK_LEVELS).optional(),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const orderPatchSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  note: nullableText(1000).optional(),
}).refine((v) => v.status !== undefined || v.note !== undefined, "nothing to change");

export const blacklistSchema = z.object({ phone: bdPhone, reason: nullableText(200).default(null) });

export const steadfastSchema = z.object({ apiKey: text(200).pipe(z.string().min(8)), secretKey: text(200).pipe(z.string().min(8)) }).nullable();

/**
 * The order form's body, from a buyer's browser through the gateway. Unknown keys are dropped.
 * Prices are not in it: the server works them out from the page.
 */
export const orderSubmitSchema = z.object({
  pageId: z.string().uuid(),
  name: text(80).pipe(z.string().min(2)),
  phone: bdPhone,
  address: text(300).pipe(z.string().min(8)),
  area: z.enum(["inside_dhaka", "outside_dhaka"]),
  district: nullableText(40).optional().default(null),
  quantity: z.coerce.number().int().min(1).max(20),
  option: nullableText(80).optional().default(null),
  note: nullableText(300).optional().default(null),
  hp: z.string().max(200).optional(),
  anonymous_id: z.string().max(64).nullable().optional(),
  session_id: z.string().max(64).nullable().optional(),
  ad: z.record(z.unknown()).nullable().optional(),
  page_url: z.string().max(2000).nullable().optional(),
});
