/**
 * Endpoint functions for form submissions. No React, no hooks — just transport.
 *
 * Submissions belong to a form (an automation with a lead form), not to the site: there is no
 * site-wide inbox. The demo site answers from `lib/demo/submissions`, addresses on the reserved
 * example.com domain.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { demoFormSummary, demoSubmissionsCsv, demoSubmissionsPage } from '@/lib/demo/submissions';
import type { FormSummary, SubmissionFilters, SubmissionPage } from './types';

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
