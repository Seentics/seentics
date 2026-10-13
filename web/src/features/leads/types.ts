export const CONTACT_STATUSES = ['new', 'contacted', 'archived'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

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
  fields: Record<string, string | number | boolean>;
  page_url: string;
  referrer: string;
  created_at: string;
};

export type ContactFilters = {
  search: string;
  /** Empty means every status. */
  status: ContactStatus | '';
  limit: number;
  offset: number;
};

export type ContactPage = { contacts: Contact[]; total: number };
export type ContactDetail = { contact: Contact; submissions: ContactSubmission[] };

export type LeadStats = {
  total: number;
  last_7_days: number;
  by_automation: { automation_id: string | null; name: string | null; count: number }[];
};
