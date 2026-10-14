import type { LeadQueries, LeadSink, FormSummary, StoredSubmission, SubmissionListQuery, SubmissionView, WebsiteLeadSummary } from "../interfaces";
import { exportSubmissions, formSummary, listSubmissions, websiteSummary } from "../repositories/submission.repository";

/** Start of the current calendar month, UTC — the window the monthly plan limit counts. */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Dashboard reads for one form's submissions.
 *
 * Takes already-resolved ids: the controller checks membership, and every statement here is
 * scoped by website and automation regardless, because a submission id is a UUID a member of
 * another site could be handed and must not be able to read through.
 */
export class SubmissionQueryService implements LeadQueries {
  constructor(private readonly sink: Pick<LeadSink, "statuses">) {}

  async listSubmissions(
    websiteId: string,
    automationId: string,
    q: SubmissionListQuery,
  ): Promise<{ submissions: SubmissionView[]; total: number }> {
    const { rows, total } = await listSubmissions(websiteId, automationId, q);
    const deliveries = await this.sink.statuses(websiteId, rows.map((r) => r.id));
    return { submissions: rows.map((r) => ({ ...r, deliveries: deliveries.get(r.id) ?? [] })), total };
  }

  summary(websiteId: string, automationId: string): Promise<FormSummary> {
    return formSummary(websiteId, automationId);
  }

  websiteSummary(websiteId: string): Promise<WebsiteLeadSummary> {
    return websiteSummary(websiteId, startOfMonthUtc());
  }

  exportSubmissions(websiteId: string, automationId: string, limit: number): Promise<StoredSubmission[]> {
    return exportSubmissions(websiteId, automationId, limit);
  }
}
