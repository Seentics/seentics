import type { RetentionCutoffs, RetentionOptions, RetentionPurge, RetentionTarget } from "../../../platform/retention/interfaces";
import { purgeBefore, SUBMISSION_RETENTION_DAYS } from "../repositories/submission.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ages out stored submissions after `SUBMISSION_RETENTION_DAYS`.
 *
 * A fixed window rather than the analytics cut-offs: submissions hold an address and what the
 * visitor typed, so how long they live is a promise the privacy page makes, not a tuning knob.
 * Prize claims are not touched; they hold a hash and no personal data.
 */
export class LeadsRetentionPurge implements RetentionPurge {
  readonly name = "leads";

  constructor(private readonly now: () => number = Date.now) {}

  async purge(target: RetentionTarget, _cutoffs: RetentionCutoffs, _options: RetentionOptions): Promise<Record<string, number>> {
    const deleted = await purgeBefore(target.websiteId, new Date(this.now() - SUBMISSION_RETENTION_DAYS * DAY_MS));
    return { leadSubmissionRows: deleted };
  }
}
