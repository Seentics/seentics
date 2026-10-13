import type { RetentionCutoffs, RetentionOptions, RetentionPurge, RetentionTarget } from "../../../platform/retention/interfaces";
import { purgeDeliveriesBefore } from "../repositories/integration.repository";

/**
 * Ages out the delivery log with the rest of a site's automation history.
 *
 * Only the log: connections are configuration the owner made and keep until they remove them,
 * and the leads those deliveries were about are customer records this sweep never touches.
 */
export class IntegrationsRetentionPurge implements RetentionPurge {
  readonly name = "integrations";

  async purge(target: RetentionTarget, cutoffs: RetentionCutoffs, _options: RetentionOptions): Promise<Record<string, number>> {
    const deleted = await purgeDeliveriesBefore(target.websiteId, cutoffs.funnelAutomation);
    return { integrationDeliveryRows: deleted };
  }
}
