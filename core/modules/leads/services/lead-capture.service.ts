import { log } from "../../../platform/observability/logger";
import type { AutomationDirectory } from "../../automations/interfaces";
import type { CapturedLead, LeadCapture, LeadCapturedListener, LeadSubmission } from "../interfaces";
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
    const submission = await this.withVerifiedAttribution(input);
    const stored = await insertSubmission(submission);
    const captured: CapturedLead = { ...stored, submission };
    this.notify(captured);
    return captured;
  }

  onCaptured(listener: LeadCapturedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
