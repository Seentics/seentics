import type { LeadSink, QueuedLead, SubmissionDelivery } from "../../leads/interfaces";
import { toLeadPayload } from "../lib/lead-payload";
import { deliveriesOfSubmissions, enqueueDeliveries, forgetSubmissions } from "../repositories/delivery.repository";

/**
 * The integrations side of the leads module's `LeadSink`: the delivery outbox.
 *
 * `enqueue` is a single database write, so the visitor's request never waits on a third
 * party and a lead that was accepted is a lead that will be attempted, even across a restart.
 */
export class OutboxService implements LeadSink {
  constructor(private readonly wake: () => void) {}

  enqueue(lead: QueuedLead, destinationIds: readonly string[] | null): Promise<number> {
    if (destinationIds && destinationIds.length === 0) return Promise.resolve(0);
    return enqueueDeliveries({
      websiteId: lead.submission.websiteId,
      submissionId: lead.submissionId,
      automationId: lead.submission.automationId,
      payload: toLeadPayload(lead),
      destinationIds,
    });
  }

  kick(): void {
    this.wake();
  }

  async statuses(websiteId: string, submissionIds: readonly string[]): Promise<Map<string, SubmissionDelivery[]>> {
    const out = new Map<string, SubmissionDelivery[]>();
    for (const { submission_id, ...delivery } of await deliveriesOfSubmissions(websiteId, submissionIds)) {
      out.set(submission_id, [...(out.get(submission_id) ?? []), delivery]);
    }
    return out;
  }

  forget(websiteId: string, submissionIds: readonly string[]): Promise<void> {
    return forgetSubmissions(websiteId, submissionIds);
  }
}
