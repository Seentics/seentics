import { z } from "zod";
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
  // Click and pixel ids for server-side conversions; shape-checked where it is used.
  ad: z.record(z.unknown()).nullable().optional(),
  hp: z.string().optional(),
});
export type LeadSubmitBody = z.infer<typeof leadSubmitSchema>;

export const submissionListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

const uuid = z.string().uuid();
const isoDate = z.string().trim().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "invalid date").transform((v) => new Date(v));
const status = z.enum(["new", "contacted", "qualified", "customer", "lost"]);
const tags = z.array(z.string().max(100)).max(50);

/** The site-wide inbox's filters. `to` is exclusive. */
export const siteSubmissionListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  form: uuid.optional().transform((v) => v ?? null),
  from: isoDate.optional().transform((v) => v ?? null),
  to: isoDate.optional().transform((v) => v ?? null),
  /** `failed`: only submissions at least one destination could not take. */
  delivery: z.enum(["failed"]).optional().transform((v) => v ?? null),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

const leadChannel = z.enum(["paid", "email", "social", "organic", "campaign", "internal", "referral", "direct"]);

export const contactListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: status.optional().transform((v) => v ?? null),
  tag: z.string().trim().min(1).max(100).optional().transform((v) => v ?? null),
  source: z.enum(["form", "manual", "import"]).optional().transform((v) => v ?? null),
  channel: leadChannel.optional().transform((v) => v ?? null),
  campaign: z.string().trim().min(1).max(200).optional().transform((v) => v ?? null),
  sort: z.enum(["last_activity", "created"]).default("last_activity"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const contactCreateSchema = z.object({
  email,
  name: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(50).default(""),
  status: status.default("new"),
  tags: tags.default([]),
  notes: z.string().max(5000).default(""),
}).transform((c) => ({ ...c, email: c.email.toLowerCase() }));

/** Email is not editable: submissions are joined to a contact by it. */
export const contactPatchSchema = z.object({
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  status: status.optional(),
  tags: tags.optional(),
  notes: z.string().max(5000).optional(),
}).strict();

const ids = z.array(uuid).min(1).max(1000);

export const contactBulkSchema = z.object({
  ids,
  status: status.optional(),
  add_tags: tags.optional(),
  remove_tags: tags.optional(),
}).refine((b) => b.status || b.add_tags?.length || b.remove_tags?.length, "nothing to change");

export const contactDeleteSchema = z.object({ ids, with_submissions: z.boolean().default(false) });

/** The most rows one import request may carry; the dashboard sends bigger files in chunks. */
export const IMPORT_CHUNK = 5000;

export const contactImportSchema = z.object({
  rows: z.array(z.object({
    email: z.string().max(400),
    name: z.string().max(400).optional(),
    phone: z.string().max(100).optional(),
    status: z.string().max(40).optional(),
    tags: tags.optional(),
    notes: z.string().max(10_000).optional(),
  })).min(1).max(IMPORT_CHUNK),
  update_existing: z.boolean().default(false),
});

/** The leads overview's window, in days. */
export const leadsOverviewSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
