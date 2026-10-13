import type { AuthedRouter, PublicRouter } from "../../../platform/http/router";
import type { ModuleLifecycle } from "../../../app/module";
import type { UsageCounter } from "../../../platform/usage";

export const CONTACT_STATUSES = ["new", "contacted", "archived"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** A form's extra fields, after sanitising: short string/number/boolean values only. */
export type LeadFields = Record<string, string | number | boolean>;

/**
 * One submission as the tracker sends it, validated and normalised.
 *
 * `email` is already trimmed and lower-cased; `automationId` and `variant` are claims by
 * the browser and are only stored when the automation exists on this website.
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

export type Contact = {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: ContactStatus;
  consent: boolean;
  submission_count: number;
  first_submitted_at: string;
  last_submitted_at: string;
};

export type ContactSubmission = {
  id: string;
  automation_id: string | null;
  automation_name: string | null;
  variant: string | null;
  fields: LeadFields;
  page_url: string;
  referrer: string;
  created_at: string;
};

export type ContactListQuery = {
  search: string;
  status: ContactStatus | "";
  limit: number;
  offset: number;
};

export type LeadStats = {
  total: number;
  last_7_days: number;
  by_automation: { automation_id: string | null; name: string | null; count: number }[];
};

/** What a successful capture reports, for listeners. */
export type CapturedLead = {
  contactId: string;
  isNewContact: boolean;
  submission: LeadSubmission;
};

/**
 * Something that wants to hear about every captured lead — an email-platform connector, a
 * webhook forwarder. Called after the row is committed and never awaited by the visitor's
 * request, so a slow or failing listener cannot lose a lead or slow a form.
 */
export type LeadCapturedListener = (lead: CapturedLead) => Promise<void> | void;

export interface LeadCapture {
  /** Store a submission. Idempotent per email: a repeat refreshes the contact. */
  capture(submission: LeadSubmission): Promise<CapturedLead>;
  /** Register a listener. Returns an unsubscribe function. */
  onCaptured(listener: LeadCapturedListener): () => void;
}

export interface LeadQueries {
  listContacts(websiteId: string, q: ContactListQuery): Promise<{ contacts: Contact[]; total: number }>;
  getContact(
    websiteId: string,
    contactId: string,
  ): Promise<{ contact: Contact; submissions: ContactSubmission[] } | null>;
  stats(websiteId: string): Promise<LeadStats>;
  /** Every contact on the site, oldest first, capped — for export. */
  exportContacts(websiteId: string, limit: number): Promise<Contact[]>;
}

export interface LeadMutations {
  /** False when the contact is not on this website. */
  setStatus(websiteId: string, contactId: string, status: ContactStatus): Promise<boolean>;
  /** Erases the contact and its submissions. False when it is not on this website. */
  deleteContact(websiteId: string, contactId: string): Promise<boolean>;
}

export type LeadsModule = ModuleLifecycle & {
  capture: LeadCapture;
  queries: LeadQueries;
  mutations: LeadMutations;
  usage: UsageCounter;
  /** The dashboard inbox, behind the session middleware. */
  routes: AuthedRouter;
  /** The anonymous submit endpoint a popup form posts to; mounted under `/tracker/leads`. */
  trackerRoutes: PublicRouter;
};
