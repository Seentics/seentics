import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";
import { affectedRows } from "../../../platform/retention";

/**
 * Deletes aged execution history from `automation_events`.
 *
 * `automation_events` carries no website column — it is keyed by `automation_id` alone
 * — so scoping to a website requires the join through `automations`. That is also why
 * this cannot live in retention: the join encodes how this module relates its two
 * tables, which is exactly the knowledge the boundary is meant to contain.
 */
export class AutomationRetentionPurge implements RetentionPurge {
  readonly name = "automations";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    const deleted = await sql`
      DELETE FROM automation_events AS ae
      USING automations AS a
      WHERE ae.automation_id = a.id
        AND a.website_id = ${target.websiteId}::uuid
        AND ae.created_at < ${cutoffs.funnelAutomation}
    `;

    // Webhook delivery logs: the URL and outcome of each call, kept as long as the
    // execution history they belong to.
    const deliveries = await sql`
      DELETE FROM webhook_deliveries AS wd
      USING automations AS a
      WHERE wd.automation_id = a.id
        AND a.website_id = ${target.websiteId}::uuid
        AND wd.created_at < ${cutoffs.funnelAutomation}
    `;

    // Visitor profiles hold what a site passed to `identify()` — often a name or an
    // email — and they were kept for ever. A profile ages out with the analytics it was
    // built from: a visitor not seen within the analytics window is forgotten, along
    // with the links from their anonymous ids to the site's own user id.
    const profiles = await sql`
      DELETE FROM user_profiles
      WHERE website_id = ${target.websiteId}::uuid
        AND last_seen_at < ${cutoffs.analytics}
    `;
    const aliases = await sql`
      DELETE FROM identity_aliases AS ia
      WHERE ia.website_id = ${target.websiteId}::uuid
        AND ia.linked_at < ${cutoffs.analytics}
        AND NOT EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.website_id = ia.website_id AND up.anonymous_id = ia.anonymous_id
        )
    `;

    return {
      automationExecutionRows: affectedRows(deleted),
      webhookDeliveryRows: affectedRows(deliveries),
      visitorProfileRows: affectedRows(profiles),
      identityAliasRows: affectedRows(aliases),
    };
  }
}
