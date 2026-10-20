import type { AuthedRouter, PublicRouter } from "../../../platform/http/router";
import type { ModuleLifecycle } from "../../../app/module";
import type { RetentionPurge } from "../../../platform/retention";
import type { UsageCounter } from "../../../platform/usage";
import type { SiteMetricSource } from "../../agency/interfaces";

/** A form's extra answers, after sanitising: short string/number/boolean values only. */
export type LeadFields = Record<string, string | number | boolean>;

/**
 * One submission as the tracker sends it, validated and normalised.
 *
 * `email` is already trimmed and lower-cased; `automationId` and `variant` are claims by
 * the browser and are only kept when the automation exists on this website.
 */
export type LeadSubmission = {
  websiteId: string;
  email: string;
  name: string;
  phone: string;
  consent: boolean;
  fields: LeadFields;
  anonymousId: string | null;
  sessionId: string | null;
  automationId: string | null;
  variant: string | null;
  pageUrl: string;
  referrer: string;
  /**
   * For server-side conversions only, never stored with the submission: the request's IP
   * and browser, and the click and pixel ids the tracker sent (null for an anonymous visitor).
   */
  clientIp?: string;
  userAgent?: string;
  ad?: Record<string, unknown> | null;
};

/**
 * A reward chosen by the server for a submission: a wheel slice or a coupon.
 *
 * `coupon_code` is null for a no-prize slice. This is the only place a code reaches the
 * browser — the page's copy of the popup has them redacted.
 */
export type Prize = {
  id: string;
  label: string;
  coupon_code: string | null;
};

/** What a successful capture reports to the visitor's request. */
export type CapturedLead = {
  submissionId: string;
  /** Set when the popup pays a reward. A returning email gets the prize it had before. */
  prize: Prize | null;
  /** How many destinations the lead was queued for. Zero is allowed: it is still stored. */
  queuedFor: number;
};

/** A stored submission, as the sink needs it to deliver it. */
export type QueuedLead = {
  submissionId: string;
  submission: LeadSubmission;
  prize: Prize | null;
  submittedAt: string;
};

/** How one destination is doing with one submission. */
export type SubmissionDelivery = {
  /** The delivery's own id; what "retry" is called with. */
  id: string;
  connection_id: string;
  connection_name: string;
  provider: string;
  status: "pending" | "success" | "failed" | "skipped";
  attempt_count: number;
  error: string | null;
  completed_at: string | null;
};

/**
 * Where a stored submission goes next — implemented by the integrations module.
 *
 * `enqueue` is awaited by the visitor's request and must be a durable write and nothing
 * more: no call to a third party may happen inside it. A lead that was stored but never
 * queued would be silently lost, so a failure here fails the request and the visitor retries.
 */
export interface LeadSink {
  /**
   * Queue the lead for each enabled destination on its website, narrowed to
   * `destinationIds` when the form names some (`null` means all). Returns the rows created.
   */
  enqueue(lead: QueuedLead, destinationIds: readonly string[] | null): Promise<number>;
  /** Wake the delivery worker; does not wait for it. */
  kick(): void;
  /** Delivery state per submission, for the form's submissions list. */
  statuses(websiteId: string, submissionIds: readonly string[]): Promise<Map<string, SubmissionDelivery[]>>;
  /**
   * The site's submissions with at least one failed delivery, newest first, at most `limit`;
   * since `since` when given. For the inbox's "failed to send" filter and the leads overview.
   */
  failedSubmissionIds(websiteId: string, since: Date | null, limit: number): Promise<string[]>;
  /** Cancel pending deliveries and clear the payloads of the rest, when submissions are erased. */
  forget(websiteId: string, submissionIds: readonly string[]): Promise<void>;
}

export interface LeadCapture {
  /** Store a submission and queue it for delivery. */
  capture(submission: LeadSubmission): Promise<CapturedLead>;
}

export type SubmissionView = {
  id: string;
  email: string;
  name: string;
  phone: string;
  consent: boolean;
  fields: LeadFields;
  prize: Prize | null;
  variant: string | null;
  page_url: string;
  referrer: string;
  created_at: string;
  deliveries: SubmissionDelivery[];
};

export type SubmissionListQuery = {
  search: string;
  limit: number;
  offset: number;
};

export type FormSummary = {
  total: number;
  last_7_days: number;
  last_30_days: number;
  with_prize: number;
  by_variant: { variant: string; count: number }[];
};

export type WebsiteLeadSummary = { total: number; last_7_days: number; this_month: number };

/** A submission row exactly as stored, before delivery state is attached. */
export type StoredSubmission = Omit<SubmissionView, "deliveries">;

export interface LeadQueries {
  listSubmissions(
    websiteId: string,
    automationId: string,
    q: SubmissionListQuery,
  ): Promise<{ submissions: SubmissionView[]; total: number }>;
  summary(websiteId: string, automationId: string): Promise<FormSummary>;
  websiteSummary(websiteId: string): Promise<WebsiteLeadSummary>;
  /** Every stored submission of the form, newest first, capped — for export. */
  exportSubmissions(websiteId: string, automationId: string, limit: number): Promise<StoredSubmission[]>;
}

export interface LeadMutations {
  /** Erases the submission and its pending deliveries. False when it is not on this form. */
  deleteSubmission(websiteId: string, automationId: string, submissionId: string): Promise<boolean>;
}

export type LeadsModule = ModuleLifecycle & {
  capture: LeadCapture;
  queries: LeadQueries;
  mutations: LeadMutations;
  /** The site-wide inbox and contacts. */
  site: SiteLeadQueries;
  contacts: ContactMutations;
  /** Form submissions this calendar month, per account — the `leads` plan limit's count. */
  usage: UsageCounter;
  /** Form submissions per site, for the agency overview. */
  agencyMetrics: SiteMetricSource;
  /** Ages out stored submissions after `SUBMISSION_RETENTION_DAYS`. */
  retention: RetentionPurge;
  /** Each form's submissions, the site-wide inbox and contacts, behind the session middleware. */
  routes: AuthedRouter;
  /** The anonymous submit endpoint a popup form posts to; mounted under `/tracker/leads`. */
  trackerRoutes: PublicRouter;
};

// ---------------------------------------------------------------------------
// The site-wide inbox and contacts.

export type LeadChannel = "paid" | "email" | "social" | "organic" | "campaign" | "internal" | "referral" | "direct";

/** A submission in the site-wide list: its form, where it came from and whether it was recorded. */
export type SiteSubmissionView = SubmissionView & {
  automation_id: string | null;
  form_name: string | null;
  session_id: string | null;
  has_replay: boolean;
  channel: LeadChannel;
  utm_source: string | null;
  utm_campaign: string | null;
  contact_id: string | null;
};

/** A stored submission row as the site-wide list reads it, before the joins in the service. */
export type SiteSubmissionRow = StoredSubmission & {
  automation_id: string | null;
  session_id: string | null;
  contact_id: string | null;
};

export type SiteSubmissionQuery = {
  search: string;
  form: string | null;
  from: Date | null;
  to: Date | null;
  /** `failed`: only submissions at least one destination could not take. */
  delivery: "failed" | null;
  limit: number;
  offset: number;
};

export const CONTACT_STATUSES = ["new", "contacted", "qualified", "customer", "lost"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type ContactSource = "form" | "manual" | "import";

export type ContactRow = {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: ContactStatus;
  tags: string[];
  notes: string;
  source: ContactSource;
  submission_count: number;
  first_seen_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  first_page_url: string;
  first_referrer: string;
  /** Stored from 075 on; null on older rows, which are classified on view. */
  first_channel: LeadChannel | null;
  first_campaign: string | null;
};

export type ContactView = Omit<ContactRow, "first_page_url" | "first_referrer" | "first_channel"> & {
  first_channel: LeadChannel | null;
  first_page_url: string | null;
  first_referrer: string | null;
};

export type ContactListQuery = {
  search: string;
  status: ContactStatus | null;
  tag: string | null;
  source: ContactSource | null;
  /** Where they first came from: a channel, and the UTM campaign of that first page. */
  channel: LeadChannel | null;
  campaign: string | null;
  sort: "last_activity" | "created";
  limit: number;
  offset: number;
};

export type ContactInput = {
  email: string;
  name: string;
  phone: string;
  status: ContactStatus;
  tags: string[];
  notes: string;
};

export type ContactPatch = Partial<Pick<ContactInput, "name" | "phone" | "status" | "tags" | "notes">>;

export type ContactBulkChange = { status?: ContactStatus; add_tags?: string[]; remove_tags?: string[] };

export type ImportResult = { created: number; updated: number; skipped: number; errors: { row: number; reason: string }[] };

export type FormOption = { id: string; name: string; count: number };

export interface SiteLeadQueries {
  listSubmissions(websiteId: string, q: SiteSubmissionQuery): Promise<{ submissions: SiteSubmissionView[]; total: number }>;
  exportSubmissions(websiteId: string, q: SiteSubmissionQuery, limit: number): Promise<SiteSubmissionView[]>;
  forms(websiteId: string): Promise<FormOption[]>;
  listContacts(websiteId: string, q: ContactListQuery): Promise<{ contacts: ContactView[]; total: number; statuses: Record<ContactStatus, number> }>;
  exportContacts(websiteId: string, q: ContactListQuery, limit: number): Promise<ContactView[]>;
  contact(websiteId: string, id: string): Promise<{ contact: ContactView; submissions: SiteSubmissionView[] } | null>;
  /** Every tag in use on the site's contacts, with how many carry it. */
  tags(websiteId: string): Promise<{ tag: string; count: number }[]>;
  /** The leads page's numbers for the last `days` days. */
  overview(websiteId: string, days: number): Promise<LeadsOverview>;
}

/**
 * The leads page's numbers over a window: submissions and where they came from, the people who
 * first arrived in it and how many of those are customers now, and what failed to send.
 */
export type LeadsOverview = {
  days: number;
  /** Form submissions in the window. */
  submissions: number;
  /** Contacts first seen in the window. */
  new_contacts: number;
  /** Of those new contacts, the ones whose status is now Customer. */
  customers: number;
  /** The window's submissions by channel, most first. */
  by_channel: { channel: LeadChannel; count: number }[];
  /** The window's submissions by source (lib/source.ts: facebook, google, a host), the top six. */
  by_source: { source: string; count: number }[];
  /** The window's submissions by UTM campaign, the top five, each with the source that sent most of it. */
  by_campaign: { campaign: string; count: number; source: string | null }[];
  /** The window's submissions that at least one destination could not take. */
  failed_deliveries: number;
  /** The same counts over the window before it, as long: to show what went up or down. */
  previous: { submissions: number; new_contacts: number; customers: number };
};

export interface ContactMutations {
  /** `exists` carries the id of the contact that already has this email. */
  create(websiteId: string, input: ContactInput): Promise<{ contact: ContactView } | { exists: string }>;
  update(websiteId: string, id: string, patch: ContactPatch): Promise<ContactView | null>;
  bulk(websiteId: string, ids: readonly string[], change: ContactBulkChange): Promise<number>;
  /** Deletes the contacts; with `withSubmissions`, their stored submissions and queued deliveries too. */
  remove(websiteId: string, ids: readonly string[], withSubmissions: boolean): Promise<number>;
  import(websiteId: string, rows: readonly ImportRowInput[], updateExisting: boolean): Promise<ImportResult>;
  /** Erases one submission anywhere on the site. False when it is not on this website. */
  deleteSubmission(websiteId: string, submissionId: string): Promise<boolean>;
}

export type ImportRowInput = { email: string; name?: string; phone?: string; status?: string; tags?: string[]; notes?: string };
