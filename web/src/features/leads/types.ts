import type { DeliveryStatus, ProviderId } from '@/features/integrations/types';

/** Where one submission was sent, and how that went. */
export type SubmissionDelivery = {
  /** The delivery's own id: what a retry is addressed to. */
  id: string;
  connection_id: string;
  connection_name: string;
  provider: ProviderId;
  status: DeliveryStatus;
  attempt_count: number;
  error: string | null;
  completed_at: string | null;
};

/** The reward the server drew for a spin wheel or coupon popup. */
export type SubmissionPrize = { id: string; label: string; coupon_code: string | null };

/** One form submission, as listed on the automation's page. */
export type Submission = {
  id: string;
  email: string;
  name: string;
  phone: string;
  consent: boolean;
  fields: Record<string, string | number | boolean>;
  prize: SubmissionPrize | null;
  variant: string | null;
  page_url: string;
  referrer: string;
  created_at: string;
  deliveries: SubmissionDelivery[];
};

export type SubmissionFilters = { search: string; limit: number; offset: number };
export type SubmissionPage = { submissions: Submission[]; total: number };

export type FormSummary = {
  total: number;
  last_7_days: number;
  last_30_days: number;
  by_variant: { variant: string | null; count: number }[];
  with_prize: number;
};

// ── Site-wide: every form's submissions, and the contacts they became ───────────

/** How a visitor reached the site, as the analytics classify it. */
export type LeadChannel = 'paid' | 'email' | 'social' | 'organic' | 'campaign' | 'internal' | 'referral' | 'direct';

/** A submission in the site-wide list: the per-form row plus which form, where from, and its contact. */
export type SiteSubmission = Submission & {
  automation_id: string | null;
  form_name: string | null;
  session_id: string | null;
  /** A recording of the visit exists, so "Watch" can open it. */
  has_replay: boolean;
  channel: LeadChannel;
  utm_source: string | null;
  utm_campaign: string | null;
  contact_id: string | null;
};

export type SiteSubmissionFilters = {
  search: string;
  /** An automation id, or '' for every form. */
  form: string;
  /** ISO timestamps bounding `created_at`; '' leaves that side open. */
  from: string;
  to: string;
  limit: number;
  offset: number;
};
/**
 * The form a submission came from. No name means one of two things: its popup was deleted
 * (the automation id is still recorded), or there never was a popup — the site's own form,
 * sent to the leads endpoint directly — which "Deleted form" misdescribed.
 */
export function formLabel(s: Pick<SiteSubmission, 'form_name' | 'automation_id'>): { text: string; known: boolean } {
  if (s.form_name) return { text: s.form_name, known: true };
  return { text: s.automation_id ? 'Deleted form' : 'Website form', known: false };
}

export type SiteSubmissionPage = { submissions: SiteSubmission[]; total: number };

/** A form that has submissions, for the form filter. */
export type LeadForm = { id: string; name: string; count: number };

export const CONTACT_STATUSES = ['new', 'contacted', 'qualified', 'customer', 'lost'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type ContactSource = 'form' | 'manual' | 'import';

/** A person, kept until deleted. Form submissions with their email feed it; it can also be added by hand or imported. */
export type Contact = {
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
  first_channel: LeadChannel | null;
  first_page_url: string | null;
  first_referrer: string | null;
};

export type ContactSort = 'last_activity' | 'created';
export type ContactFilters = {
  search: string;
  /** '' for every status. */
  status: ContactStatus | '';
  tag: string;
  source: ContactSource | '';
  sort: ContactSort;
  limit: number;
  offset: number;
};
export type ContactPage = { contacts: Contact[]; total: number; statuses: Record<ContactStatus, number> };
export type ContactDetail = { contact: Contact; submissions: SiteSubmission[] };

/** What can be set when adding a contact; only `email` is required. */
export type ContactInput = { email: string; name?: string; phone?: string; status?: ContactStatus; tags?: string[]; notes?: string };
/** What can be changed afterwards: everything but the email. */
export type ContactPatch = Omit<ContactInput, 'email'>;
export type ContactBulkChange = { ids: string[]; status?: ContactStatus; add_tags?: string[]; remove_tags?: string[] };
export type ImportRow = ContactInput;
export type ImportResult = { created: number; updated: number; skipped: number; errors: { row: number; reason: string }[] };
