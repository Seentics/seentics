import type { AuthedRouter, PublicRouter } from "../../../platform/http/router";
import type { ModuleLifecycle } from "../../../app/module";
import type { RetentionPurge } from "../../../platform/retention";
import type { UsageCounter } from "../../../platform/usage";

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
  /** Form submissions this calendar month, per account — the `leads` plan limit's count. */
  usage: UsageCounter;
  /** Ages out stored submissions after `SUBMISSION_RETENTION_DAYS`. */
  retention: RetentionPurge;
  /** Each form's submissions, behind the session middleware. */
  routes: AuthedRouter;
  /** The anonymous submit endpoint a popup form posts to; mounted under `/tracker/leads`. */
  trackerRoutes: PublicRouter;
};
