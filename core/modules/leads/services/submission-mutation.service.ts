import type { LeadMutations, LeadSink } from "../interfaces";
import { deleteSubmission } from "../repositories/submission.repository";

/** Erasing a submission also cancels what is still waiting to be sent about it. */
export class SubmissionMutationService implements LeadMutations {
  constructor(private readonly sink: Pick<LeadSink, "forget">) {}

  async deleteSubmission(websiteId: string, automationId: string, submissionId: string): Promise<boolean> {
    const deleted = await deleteSubmission(websiteId, automationId, submissionId);
    if (deleted) await this.sink.forget(websiteId, [submissionId]);
    return deleted;
  }
}
