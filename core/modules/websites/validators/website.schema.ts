import { z } from "zod";
import { zNonEmptyString, zUrl } from "../../../platform/validation";
import { normalizeHostname } from "../lib/hostname";

/** A URL or bare host the site can be stored under (lib/hostname.ts). */
export const zSiteAddress = z.string().trim().min(1).max(2048).refine((v) => {
  try {
    normalizeHostname(v);
    return true;
  } catch {
    return false;
  }
}, "invalid website URL format");

export const websiteCreateSchema = z.object({
  name: zNonEmptyString.max(120),
  url: zUrl,
});

/**
 * The fields with rules are checked; anything else passes to `toUpdateWebsiteInput`, which
 * keeps the keys it knows. This was `z.record(z.unknown())`: a blank name or a sampling rate
 * of 5 was stored, and an unparseable URL threw in the repository and came back as 403.
 */
export const websitePatchSchema = z.object({
  name: zNonEmptyString.max(120).optional(),
  url: zSiteAddress.optional(),
  replay_sampling_rate: z.number().min(0).max(1).optional(),
}).passthrough();

export const goalCreateSchema = z.object({
  name: zNonEmptyString.max(120),
  type: zNonEmptyString.max(64),
  identifier: zNonEmptyString.max(256),
  selector: z.string().trim().max(1024).optional(),
});

/** A supplied field obeys the same rules as on create; `selector: null` clears it. */
export const goalPatchSchema = z.object({
  name: zNonEmptyString.max(120).optional(),
  type: zNonEmptyString.max(64).optional(),
  identifier: zNonEmptyString.max(256).optional(),
  selector: z.string().trim().max(1024).nullable().optional(),
}).passthrough();

/**
 * The four roles, as an enum rather than a free string.
 *
 * This accepted any non-empty string up to 32 characters, so `"owner"` sailed through
 * with nothing downstream comparing it to the caller's own role — and an unrecognised
 * value was stored verbatim, to be normalised to `viewer` only when read back. The
 * privilege rules live in `WebsiteMemberService`; this stops a nonsense role reaching
 * the table in the first place.
 */
export const websiteRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const memberAddSchema = z.object({
  email: zNonEmptyString.email().max(320),
  role: websiteRoleSchema.optional(),
});

/** Same shape as adding a member: an invitation is a deferred membership. */
export const invitationCreateSchema = z.object({
  email: zNonEmptyString.email().max(320),
  role: websiteRoleSchema.optional().default("viewer"),
});

export const memberRoleSchema = z.object({
  role: websiteRoleSchema,
});

/** Offset paging for the management API's website list. */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
