import { log } from "../../../platform/observability/logger";
import type { LeadSink, QueuedLead, SubmissionDelivery } from "../../leads/interfaces";
import type { AdContext, ConversionLeadInput } from "../interfaces/conversions";
import { adContextOf } from "../lib/ad-context";
import { toLeadPayload } from "../lib/lead-payload";
import { deliveriesOfSubmissions, enqueueDeliveries, forgetSubmissions } from "../repositories/delivery.repository";

/**
 * The integrations side of the leads module's `LeadSink`: the delivery outbox.
 *
 * `enqueue` is a single database write, so the visitor's request never waits on a third
 * party and a lead that was accepted is a lead that will be attempted, even across a restart.
 */
export class OutboxService implements LeadSink {
  constructor(
    private readonly wake: () => void,
    /** Server-side conversions: given each lead whose consent box was ticked. */
    private readonly conversions: { enqueueLead(lead: ConversionLeadInput): Promise<number> } | null = null,
  ) {}

  async enqueue(lead: QueuedLead, destinationIds: readonly string[] | null): Promise<number> {
    await this.forwardConversion(lead);
    if (destinationIds && destinationIds.length === 0) return 0;
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

  /**
   * Queue the lead for the site's ad platforms, when the visitor ticked consent. Never fails
   * the lead: the form's own destinations are what the visitor's request waits on.
   */
  private async forwardConversion(lead: QueuedLead): Promise<void> {
    const s = lead.submission;
    if (!this.conversions || !s.consent) return;
    try {
      await this.conversions.enqueueLead({
        websiteId: s.websiteId,
        submissionId: lead.submissionId,
        email: s.email,
        phone: s.phone,
        pageUrl: s.pageUrl,
        visitorId: s.anonymousId,
        ip: s.clientIp ?? "",
        userAgent: s.userAgent ?? "",
        ad: adContextOf(s.ad) as AdContext | null,
        occurredAt: Date.parse(lead.submittedAt) || Date.now(),
      });
    } catch (err) {
      log.error({ msg: "conversion_lead_enqueue_failed", websiteId: s.websiteId, err: err instanceof Error ? err.message : "unknown" });
    }
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
