import { log } from "../../../platform/observability/logger";
import type { AutomationDirectory } from "../../automations/interfaces";
import type { CapturedLead, LeadCapture, LeadCapturedListener, LeadSubmission, Prize } from "../interfaces";
import { couponPrize, pickWheelPrize, withoutPrizeFields } from "../lib/prize";
import { insertSubmission } from "../repositories/lead.repository";

/**
 * Stores submissions and tells interested modules about them.
 *
 * Validation and website checks happen at the edge (the controller); by the time a
 * `LeadSubmission` gets here it is trusted data. Listeners run after the commit and are
 * isolated from each other and from the caller: a lead that is stored must never be
 * reported to the visitor as failed because a downstream connector threw.
 */
export class LeadCaptureService implements LeadCapture {
  private readonly listeners = new Set<LeadCapturedListener>();

  constructor(private readonly automations: AutomationDirectory) {}

  async capture(input: LeadSubmission): Promise<CapturedLead> {
    const submission = await this.withVerifiedAttribution({ ...input, fields: withoutPrizeFields(input.fields) });
    const stored = await insertSubmission(submission, await this.prizeChooser(submission));
    const captured: CapturedLead = { ...stored, submission };
    this.notify(captured);
    return captured;
  }

  onCaptured(listener: LeadCapturedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * How this submission's prize is decided, or `undefined` when its popup pays none.
   *
   * The popup's rewards are read from the stored definition, never from the request: the
   * browser is only ever told which prize it got. An existing prize always wins, so
   * submitting the same email again cannot re-roll a wheel.
   */
  private async prizeChooser(s: LeadSubmission): Promise<((existing: Prize | null) => Prize | null) | undefined> {
    if (!s.automationId) return undefined;
    const rewards = await this.automations.rewards(s.websiteId, s.automationId);
    if (rewards?.wheel) {
      const segments = rewards.wheel;
      return (existing) => existing ?? pickWheelPrize(segments);
    }
    if (rewards?.coupon) {
      const prize = couponPrize(rewards.coupon);
      return (existing) => existing ?? prize;
    }
    return undefined;
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

  private notify(lead: CapturedLead): void {
    for (const listener of this.listeners) {
      void Promise.resolve()
        .then(() => listener(lead))
        .catch((err) => log.error({ msg: "lead_listener_failed", contactId: lead.contactId, err }));
    }
  }
}
