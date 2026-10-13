import { z } from "zod";
import { CONTACT_STATUSES } from "../interfaces";

/** Rejects an address with no `@`/domain dot; deliberately not a full RFC check. */
const email = z.string().trim().min(3).max(254).email();

/**
 * The public submit body.
 *
 * Unknown keys are stripped, not rejected: the tracker and a site's own custom form can
 * evolve independently, and a stricter schema would turn every new field into a dropped
 * lead. `hp` is the honeypot — a field real visitors never see, so any value in it marks
 * a bot (see the controller, which acknowledges it without storing anything).
 */
export const leadSubmitSchema = z.object({
  website_id: z.string().trim().min(1).max(64),
  email,
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  consent: z.boolean().optional(),
  fields: z.record(z.unknown()).optional(),
  anonymous_id: z.string().max(128).optional(),
  session_id: z.string().max(128).optional(),
  automation_id: z.string().uuid().optional(),
  variant: z.string().max(64).optional(),
  page_url: z.string().max(2048).optional(),
  referrer: z.string().max(2048).optional(),
  hp: z.string().optional(),
});
export type LeadSubmitBody = z.infer<typeof leadSubmitSchema>;

export const contactListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum([...CONTACT_STATUSES, ""]).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const contactStatusSchema = z.object({ status: z.enum(CONTACT_STATUSES) });
