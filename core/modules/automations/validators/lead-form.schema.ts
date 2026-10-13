import { z } from "zod";

/**
 * The lead-capture form a popup can carry: `show_modal`'s `form` key.
 *
 * Validated here, strictly, even though the rest of a client action is a passthrough:
 * this is the one part of a definition the *visitor's* browser later posts back to us
 * from, so a malformed field list should fail when the owner saves it rather than
 * produce a form that silently cannot submit. Field names are identifier-shaped for the
 * same reason the leads module sanitises them — they become keys in stored answers.
 */
const fieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/i, "Field names are letters, digits and underscores"),
  type: z.enum(["text", "email", "tel"]).default("text"),
  label: z.string().max(80).default(""),
  placeholder: z.string().max(80).default(""),
  required: z.boolean().default(false),
});

/** An absolute http(s) URL or a site-relative path — nothing that can run script. */
const safeRedirect = z
  .string()
  .max(2048)
  .refine((u) => u === "" || /^(https?:\/\/|\/(?!\/))/i.test(u), "Use an http(s) URL or a path starting with /");

export const leadFormSchema = z.object({
  /** Extra fields after the always-present email. Reserved names are dropped by the tracker. */
  fields: z.array(fieldSchema).max(7).default([]),
  submit_text: z.string().max(60).default("Subscribe"),
  success_message: z.string().max(300).default("Thanks, you're subscribed."),
  success_redirect_url: safeRedirect.optional(),
  /** When set, a consent checkbox is shown; `consent_required` makes it mandatory. */
  consent_text: z.string().max(300).optional(),
  consent_required: z.boolean().default(true),
});
export type LeadForm = z.infer<typeof leadFormSchema>;
