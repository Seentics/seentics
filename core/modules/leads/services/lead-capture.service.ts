import { randomUUID } from "node:crypto";
import { log } from "../../../platform/observability/logger";
import type { AutomationDirectory } from "../../automations/interfaces";
import type { CapturedLead, LeadCapture, LeadSink, LeadSubmission, Prize } from "../interfaces";
import { hashEmail } from "../lib/email-hash";
import { couponPrize, pickWheelPrize, withoutPrizeFields } from "../lib/prize";
import { claimPrize } from "../repositories/prize.repository";
import { insertSubmission, removeSubmissionById } from "../repositories/submission.repository";

/**
 * Stores a submission, settles its prize, and queues it for the form's destinations.
 *
 * Validation and website checks happen at the edge (the controller); by the time a
 * `LeadSubmission` gets here it is trusted data. The order is the point:
 *
 *  1. the prize is claimed first, so a retry after a later failure is told the same prize;
 *  2. the submission is stored, which is what the form's page lists;
 *  3. it is queued for delivery, durably and before the visitor is answered. If that fails
 *     the stored row is withdrawn and the request fails, because a lead that is stored but
 *     will never be sent is worse than one the visitor is asked to resubmit.
 *
 * Nothing here talks to a third party: delivery happens later, in the integrations worker.
 */
export class LeadCaptureService implements LeadCapture {
  constructor(
    private readonly automations: AutomationDirectory,
    private readonly sink: LeadSink,
    private readonly newId: () => string = randomUUID,
  ) {}

  async capture(input: LeadSubmission): Promise<CapturedLead> {
    const submission = await this.withVerifiedAttribution({ ...input, fields: withoutPrizeFields(input.fields) });
    const [prize, destinations] = await Promise.all([this.settlePrize(submission), this.destinationsFor(submission)]);

    const submissionId = this.newId();
    await insertSubmission(submissionId, submission, prize);

    let queuedFor: number;
    try {
      queuedFor = await this.sink.enqueue({ submissionId, submission, prize, submittedAt: new Date().toISOString() }, destinations);
    } catch (err) {
      await removeSubmissionById(submissionId).catch((e) =>
        log.error({ msg: "lead_rollback_failed", submissionId, err: e instanceof Error ? e.message : "unknown" }),
      );
      throw err;
    }
    this.sink.kick();
    return { submissionId, prize, queuedFor };
  }

  /**
   * This submission's prize, or `null` when its popup pays none.
   *
   * The popup's rewards are read from the stored definition, never from the request: the
   * browser is only ever told which prize it got. An existing claim always wins, so
   * submitting the same email again cannot re-roll a wheel.
   */
  private async settlePrize(s: LeadSubmission): Promise<Prize | null> {
    if (!s.automationId) return null;
    const rewards = await this.automations.rewards(s.websiteId, s.automationId);
    if (!rewards) return null;
    const draw = rewards.wheel ? () => pickWheelPrize(rewards.wheel!) : rewards.coupon ? () => couponPrize(rewards.coupon!) : null;
    return draw ? claimPrize(s.websiteId, s.automationId, hashEmail(s.email), draw) : null;
  }

  /** The form's own choice of destinations; a submission with no popup goes to all. */
  private async destinationsFor(s: LeadSubmission): Promise<readonly string[] | null> {
    if (!s.automationId) return null;
    return (await this.automations.routing(s.websiteId, s.automationId))?.destinations ?? null;
  }

  /**
   * Keep the popup attribution only if that automation is on this website.
   *
   * The id comes from the browser. Stored unchecked it would let anyone credit leads to
   * another site's popup; the lead itself is still kept, just unattributed.
   */
  private async withVerifiedAttribution(s: LeadSubmission): Promise<LeadSubmission> {
    if (!s.automationId) return s;
    const known = await this.automations.names(s.websiteId, [s.automationId]);
    return known.has(s.automationId) ? s : { ...s, automationId: null, variant: null };
  }
}
