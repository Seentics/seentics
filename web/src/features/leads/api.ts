/**
 * Endpoint functions for form submissions and contacts. No React, no hooks — just transport.
 *
 * Two views of the same leads: per form (`submissionsApi`, the automation page's Submissions
 * section) and site-wide (`leadsApi`, the Leads page: every form's submissions in one inbox, and
 * the contacts they became, which are kept until deleted and can be added, edited and imported
 * by hand). The demo site answers from `lib/demo/submissions` and `lib/demo/leads`, addresses on
 * the reserved example.com domain.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoFormSummary, demoSubmissionsCsv, demoSubmissionsPage } from '@/lib/demo/submissions';
import {
  demoContactDetail, demoContactsCsv, demoContactsPage, demoContactTags, demoLeadForms, demoLeadsOverview, demoSiteSubmissionsCsv,
  demoSiteSubmissionsPage,
} from '@/lib/demo/leads';
import type {
  Contact, ContactBulkChange, ContactDetail, ContactFilters, ContactInput, ContactPage, ContactPatch,
  FormSummary, ImportResult, ImportRow, LeadForm, LeadsOverview, SiteSubmissionFilters, SiteSubmissionPage,
  SubmissionFilters, SubmissionPage,
} from './types';

const base = (websiteId: string, automationId: string) => `/leads/${websiteId}/forms/${automationId}`;

export const submissionsApi = {
  async list(websiteId: string, automationId: string, filters: SubmissionFilters): Promise<SubmissionPage> {
    if (isDemo(websiteId)) return demoSubmissionsPage(automationId, filters);
    const res = await api.get(`${base(websiteId, automationId)}/submissions`, { params: filters });
    return { submissions: res.data?.data?.submissions ?? [], total: res.data?.data?.total ?? 0 };
  },

  async summary(websiteId: string, automationId: string): Promise<FormSummary> {
    if (isDemo(websiteId)) return demoFormSummary(automationId);
    const res = await api.get(`${base(websiteId, automationId)}/summary`);
    return (res.data?.data as FormSummary | undefined) ?? { total: 0, last_7_days: 0, last_30_days: 0, by_variant: [], with_prize: 0 };
  },

  async remove(websiteId: string, automationId: string, submissionId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`${base(websiteId, automationId)}/submissions/${submissionId}`);
  },

  /** The CSV as a blob: the endpoint is authenticated, so a plain link cannot fetch it. */
  async exportCsv(websiteId: string, automationId: string): Promise<Blob> {
    if (isDemo(websiteId)) return new Blob([demoSubmissionsCsv(automationId)], { type: 'text/csv' });
    const res = await api.get(`${base(websiteId, automationId)}/submissions.csv`, { responseType: 'blob' });
    return res.data as Blob;
  },
};

/** Adding a contact whose email is already a contact: the existing one's id, to open it instead. */
export class ContactExistsError extends Error {
  constructor(readonly contactId: string | null) {
    super('A contact with this email already exists');
  }
}

const site = (websiteId: string) => `/leads/${websiteId}`;
/** Drop empty filters, so the query string carries only what narrows the list. */
const params = (filters: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined));
const EMPTY_STATUSES: ContactPage['statuses'] = { new: 0, contacted: 0, qualified: 0, customer: 0, lost: 0 };

export const leadsApi = {
  async submissions(websiteId: string, filters: SiteSubmissionFilters): Promise<SiteSubmissionPage> {
    if (isDemo(websiteId)) return demoSiteSubmissionsPage(filters);
    const res = await api.get(`${site(websiteId)}/submissions`, { params: params(filters) });
    return { submissions: res.data?.data?.submissions ?? [], total: res.data?.data?.total ?? 0 };
  },

  async forms(websiteId: string): Promise<LeadForm[]> {
    if (isDemo(websiteId)) return demoLeadForms();
    const res = await api.get(`${site(websiteId)}/forms`);
    return res.data?.data ?? [];
  },

  /** Every tag in use on the site's contacts, most used first: the tag filter's options. */
  async contactTags(websiteId: string): Promise<{ tag: string; count: number }[]> {
    if (isDemo(websiteId)) return demoContactTags();
    const res = await api.get(`${site(websiteId)}/contacts/tags`);
    return res.data?.data ?? [];
  },

  async removeSubmission(websiteId: string, submissionId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`${site(websiteId)}/submissions/${submissionId}`);
  },

  async exportSubmissions(websiteId: string, filters: Omit<SiteSubmissionFilters, 'limit' | 'offset'>): Promise<Blob> {
    if (isDemo(websiteId)) return new Blob([demoSiteSubmissionsCsv(filters)], { type: 'text/csv' });
    const res = await api.get(`${site(websiteId)}/submissions.csv`, { params: params(filters), responseType: 'blob' });
    return res.data as Blob;
  },

  /** The leads page's numbers over the last `days` days. */
  async overview(websiteId: string, days: number): Promise<LeadsOverview> {
    if (isDemo(websiteId)) return demoLeadsOverview(days);
    const res = await api.get(`${site(websiteId)}/overview`, { params: { days } });
    return res.data.data as LeadsOverview;
  },

  async contacts(websiteId: string, filters: ContactFilters): Promise<ContactPage> {
    if (isDemo(websiteId)) return demoContactsPage(filters);
    const res = await api.get(`${site(websiteId)}/contacts`, { params: params(filters) });
    const data = res.data?.data;
    return { contacts: data?.contacts ?? [], total: data?.total ?? 0, statuses: { ...EMPTY_STATUSES, ...(data?.statuses ?? {}) } };
  },

  async contact(websiteId: string, contactId: string): Promise<ContactDetail | null> {
    if (isDemo(websiteId)) return demoContactDetail(contactId);
    const res = await api.get(`${site(websiteId)}/contacts/${contactId}`);
    return res.data?.data ?? null;
  },

  async addContact(websiteId: string, input: ContactInput): Promise<Contact | null> {
    if (demoMutationGuard(websiteId)) return null;
    // 409 is an answer here, not a failure: the shared client turns error responses into a
    // plain Error without the body, which would lose the existing contact's id.
    const res = await api.post(`${site(websiteId)}/contacts`, input, {
      validateStatus: (status) => (status >= 200 && status < 300) || status === 409,
    });
    if (res.status === 409) throw new ContactExistsError(res.data?.contact_id ?? null);
    return res.data?.data ?? null;
  },

  async updateContact(websiteId: string, contactId: string, patch: ContactPatch): Promise<Contact | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.patch(`${site(websiteId)}/contacts/${contactId}`, patch);
    return res.data?.data ?? null;
  },

  async bulkUpdate(websiteId: string, change: ContactBulkChange): Promise<number> {
    if (demoMutationGuard(websiteId)) return 0;
    const res = await api.post(`${site(websiteId)}/contacts/bulk`, change);
    return res.data?.data?.updated ?? 0;
  },

  async deleteContacts(websiteId: string, ids: string[], withSubmissions: boolean): Promise<number> {
    if (demoMutationGuard(websiteId)) return 0;
    const res = await api.post(`${site(websiteId)}/contacts/delete`, { ids, with_submissions: withSubmissions });
    return res.data?.data?.deleted ?? 0;
  },

  async importContacts(websiteId: string, rows: ImportRow[], updateExisting: boolean): Promise<ImportResult> {
    if (demoMutationGuard(websiteId)) return { created: 0, updated: 0, skipped: rows.length, errors: [] };
    const res = await api.post(`${site(websiteId)}/contacts/import`, { rows, update_existing: updateExisting });
    return res.data?.data ?? { created: 0, updated: 0, skipped: 0, errors: [] };
  },

  async exportContacts(websiteId: string, filters: Omit<ContactFilters, 'limit' | 'offset'>): Promise<Blob> {
    if (isDemo(websiteId)) return new Blob([demoContactsCsv(filters)], { type: 'text/csv' });
    const res = await api.get(`${site(websiteId)}/contacts.csv`, { params: params(filters), responseType: 'blob' });
    return res.data as Blob;
  },
};
