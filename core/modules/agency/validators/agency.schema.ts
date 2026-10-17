import { z } from "zod";
import { zEmail, zNonEmptyString, zUuid } from "../../../platform/validation";
import { EMBED_SECTIONS } from "../../api-keys/interfaces";
import {
  CLIENT_STATUSES,
  COLLECT_FEATURES,
  DASHBOARD_FEATURES,
  FEATURE_ACCESS,
  isSiteAddress,
  type DashboardFeature,
  type FeatureAccess,
} from "../../websites/interfaces";
import { OVERVIEW_PERIODS, type WhiteLabelPatch } from "../interfaces";

/**
 * The agency API's request shapes.
 *
 * Unknown body keys are dropped, not refused, except where a typo would silently do
 * nothing the caller meant: the feature matrix and the collection switches name every key
 * they accept.
 *
 * White-label text is shown to the agency's clients, so it is bounded and free of control
 * characters; the logo is a remote image their browsers load, so it must be https and carry
 * no credentials. There is no upload: Core has no asset store for it.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const plainText = (max: number) =>
  z.string().trim().max(max).refine((v) => !CONTROL_CHARS.test(v), "Must not contain control characters");

/** `null` clears a field exactly as `""` does; absent leaves it alone. */
const clearable = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === null ? "" : v), schema).optional();

// ─── Paging ──────────────────────────────────────────────────────────────────

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(200).optional(),
});

const searchTerm = z.string().trim().max(200).optional();

// ─── Overview ────────────────────────────────────────────────────────────────

export const overviewQuerySchema = z.object({ period: z.enum(OVERVIEW_PERIODS).default("30d") });

export const idSchema = zUuid;

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clientListQuerySchema = pageQuerySchema.extend({
  status: z.enum(CLIENT_STATUSES).optional(),
  q: searchTerm,
});

const collectFeaturesSchema = z
  .object(Object.fromEntries(COLLECT_FEATURES.map((f) => [f, z.boolean().optional()])) as Record<string, z.ZodOptional<z.ZodBoolean>>)
  .strict();

const clientFields = {
  name: zNonEmptyString.max(120).refine((v) => !CONTROL_CHARS.test(v), "Must not contain control characters"),
  company: plainText(200).optional(),
  notes: z.string().max(2000).optional(),
};

export const clientCreateSchema = z.object(clientFields);

export const clientPatchSchema = z.object({
  ...clientFields,
  name: clientFields.name.optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  collect_features: collectFeaturesSchema.optional(),
});

/** `?confirm=true` is required: deleting a client is not undoable, even though its sites stay. */
export const deleteConfirmSchema = z.object({ confirm: z.literal("true", { errorMap: () => ({ message: "Pass confirm=true to delete a client" }) }) });

/**
 * The whole matrix or part of it: every key a known feature, every value `off | view | edit`.
 * A feature left out is `off` — the stored value is replaced, not merged.
 */
export const featuresBodySchema = z
  .object({
    features: z
      .object(
        Object.fromEntries(DASHBOARD_FEATURES.map((f) => [f, z.enum(FEATURE_ACCESS).optional()])) as Record<
          string,
          z.ZodOptional<z.ZodEnum<[FeatureAccess, ...FeatureAccess[]]>>
        >,
      )
      .strict(),
  })
  .transform((b) => ({ features: b.features as Partial<Record<DashboardFeature, FeatureAccess>> }));

// ─── Websites ────────────────────────────────────────────────────────────────

const siteAddress = z.string().trim().min(1).max(2048).refine(isSiteAddress, "Not a website address");
const siteName = zNonEmptyString.max(120);

export const websiteListQuerySchema = pageQuerySchema.extend({
  client_id: zUuid.optional(),
  unassigned: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  q: searchTerm,
});

export const clientWebsiteCreateSchema = z.object({ name: siteName, url: siteAddress });

export const websiteCreateSchema = clientWebsiteCreateSchema.extend({ client_id: zUuid.nullable().optional() });

/** `client_id` moves the site: another client's id, or `null` to take it out of any client. */
export const websitePatchSchema = z.object({
  name: siteName.optional(),
  url: siteAddress.optional(),
  client_id: zUuid.nullable().optional(),
});

// ─── Branding ────────────────────────────────────────────────────────────────

export function isSafeLogoUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname !== "" && !u.username && !u.password;
  } catch {
    return false;
  }
}

const logoUrl = z
  .string()
  .trim()
  .max(1024)
  .refine((v) => v === "" || isSafeLogoUrl(v), "Logo URL must be an https:// address");

/** `#abc` or `#aabbcc`; stored as `#aabbcc`, lower case. */
const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colour must be a hex value like #6366f1")
  .transform((v) => {
    const hex = v.slice(1).toLowerCase();
    return `#${hex.length === 3 ? [...hex].map((ch) => ch + ch).join("") : hex}`;
  });

/** Lower-cased before the check, so `Acme-Studio` is accepted as `acme-studio`. */
const slug = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9-]{3,40}$/, "Slug must be 3–40 characters: a–z, 0–9 and hyphens"));

/** Partial, like a PATCH: the settings form sends every field, an API caller only what it changes. */
export const brandingBodySchema = z.object({
  brand_name: clearable(plainText(80)),
  logo_url: clearable(logoUrl),
  primary_color: hexColor.optional(),
  support_email: clearable(z.union([z.literal(""), zEmail])),
  footer_text: clearable(plainText(200)),
  hide_seentics: z.boolean().optional(),
  slug: slug.nullable().optional(),
});

export function toWhiteLabelPatch(body: z.infer<typeof brandingBodySchema>): WhiteLabelPatch {
  return {
    brandName: body.brand_name,
    logoUrl: body.logo_url,
    primaryColor: body.primary_color,
    supportEmail: body.support_email,
    footerText: body.footer_text,
    hideSeentics: body.hide_seentics,
    slug: body.slug,
  };
}

// ─── Embeds ──────────────────────────────────────────────────────────────────

const sections = z.array(z.enum(EMBED_SECTIONS)).min(1, "Choose at least one section");

export const embedCreateSchema = z.object({
  scope: z.enum(["website", "client"]),
  target_id: zUuid,
  sections: sections.optional(),
});

export const embedPatchSchema = z.object({ sections });

export const embedListQuerySchema = pageQuerySchema.extend({
  scope: z.enum(["website", "client"]).optional(),
  target_id: zUuid.optional(),
});
