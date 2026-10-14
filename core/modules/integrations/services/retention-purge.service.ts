import type { RetentionCutoffs, RetentionOptions, RetentionPurge, RetentionTarget } from "../../../platform/retention/interfaces";
import { PAYLOAD_RETENTION_DAYS, purgeDeliveries } from "../repositories/delivery.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ages out the delivery history with the rest of a site's automation history, and enforces the
 * 30-day limit on keeping a lead that was never delivered.
 *
 * Destinations are configuration the owner made and are never touched; the submissions
 * themselves belong to the leads module's own purge.
 */
export class IntegrationsRetentionPurge implements RetentionPurge {
  readonly name = "integrations";

  constructor(private readonly now: () => number = Date.now) {}

  async purge(target: RetentionTarget, cutoffs: RetentionCutoffs, _options: RetentionOptions): Promise<Record<string, number>> {
    const payloadCutoff = new Date(this.now() - PAYLOAD_RETENTION_DAYS * DAY_MS);
    const { deleted, expired, scrubbed } = await purgeDeliveries(target.websiteId, cutoffs.funnelAutomation, payloadCutoff);
    return { integrationDeliveryRows: deleted, integrationDeliveriesExpired: expired, integrationPayloadsCleared: scrubbed };
  }
}
