import { z } from "zod";
import { zEmail, zUuid } from "../../../platform/validation";
import type { WhiteLabelPatch } from "../interfaces";

/**
 * The agency module's HTTP bodies.
 *
 * White-label text is shown to the agency's clients, so it is bounded and free of control
 * characters; the logo is a remote image the portal loads, so it must be https and carry no
 * credentials. There is no upload: Core has no asset store for it.
 */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** `null` clears a field exactly as `""` does; absent leaves it alone. */
const clearable = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === null ? "" : v), schema).optional();

const plainText = (max: number) =>
  z.string().trim().max(max).refine((v) => !CONTROL_CHARS.test(v), "Must not contain control characters");

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

export const whiteLabelPatchSchema = z
  .object({
    brand_name: clearable(plainText(80)),
    logo_url: clearable(logoUrl),
    primary_color: hexColor.optional(),
    support_email: clearable(z.union([z.literal(""), zEmail])),
    footer_text: clearable(plainText(200)),
    hide_seentics: z.boolean().optional(),
  })
  .strict();

export function toWhiteLabelPatch(body: z.infer<typeof whiteLabelPatchSchema>): WhiteLabelPatch {
  return {
    brandName: body.brand_name,
    logoUrl: body.logo_url,
    primaryColor: body.primary_color,
    supportEmail: body.support_email,
    footerText: body.footer_text,
    hideSeentics: body.hide_seentics,
  };
}

export const clientUserCreateSchema = z
  .object({
    client_id: zUuid,
    email: zEmail.transform((v) => v.toLowerCase()),
    name: plainText(120).optional().default(""),
  })
  .strict();

export const clientUserListQuerySchema = z.object({ client_id: zUuid.optional() });

export const idParamSchema = zUuid;

/** Long enough for any real token, short enough that junk is refused before hashing. */
export const portalTokenBodySchema = z.object({ token: z.string().min(1).max(256) });
