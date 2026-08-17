/**
 * Domain event catalogue.
 *
 * Every event Seentics Core can publish is declared here, keyed by its wire name
 * with the exact shape of its payload. `EventBus.publish` is typed against this
 * map, so a typo in the event name or a missing payload field is a compile error
 * rather than a silently dropped event.
 *
 * Naming: `<module>.<fact_in_past_tense>`. Events describe facts that have
 * already happened — never commands or requests. If a payload needs a field that
 * consumers must have in order to act, add it here rather than expecting the
 * consumer to look it up.
 *
 * Every payload carries `occurredAt` so consumers can reason about ordering and
 * lag without depending on delivery time.
 */

/** Website identifiers, as they appear across the codebase. */
type WebsiteRef = {
  /** `websites.id` — the canonical UUID primary key. */
  websiteId: string;
  /** `websites.site_id` — the short public id used to key analytics rows. */
  siteId: string;
};

/**
 * Deliberately absent, and why — so they are not re-added on spec alone:
 *
 * - `website.member_added` / `website.member_removed`: team membership still lives
 *   in `services/websites/members.ts`, which has not been migrated into the module
 *   and has no bus to publish through.
 * - `analytics.goal_converted`: conversions are *derived* on the read path by
 *   `goals.repository`, not recorded at a moment. There is no write to hang an
 *   event on until goal matching moves into ingest.
 * - `funnel.step_reached` (declared below): reached on the ingest path. Publishing
 *   it is now possible and is the next thing to wire.
 *
 * An entry here with no publisher is speculative API — it reads as a working
 * integration point to anyone who subscribes, which is worse than its absence.
 * `analytics.batch_ingested` had exactly that problem: automation evaluation
 * subscribed to it while nothing published it.
 */
export interface EventMap {
  // ─── websites ────────────────────────────────────────────────────────────
  "website.created": WebsiteRef & {
    ownerId: string;
    url: string;
    occurredAt: Date;
  };

  "website.updated": WebsiteRef & {
    /** Only the fields that actually changed, in domain (camelCase) form. */
    changes: Record<string, unknown>;
    occurredAt: Date;
  };

  "website.deleted": WebsiteRef & {
    ownerId: string;
    occurredAt: Date;
  };

  "website.share_toggled": WebsiteRef & {
    enabled: boolean;
    occurredAt: Date;
  };

  // ─── analytics ───────────────────────────────────────────────────────────
  /**
   * A batch of tracker events was durably written. Published by the ingest
   * batch worker after the database write succeeds — not on enqueue, so
   * consumers never react to events that were later dropped.
   */
  "analytics.batch_ingested": {
    siteId: string;
    eventCount: number;
    occurredAt: Date;
  };

  // ─── recordings ──────────────────────────────────────────────────────────
  "recording.completed": {
    siteId: string;
    recordingId: string;
    visitorId: string;
    durationMs: number;
    occurredAt: Date;
  };

  // ─── heatmaps ────────────────────────────────────────────────────────────
  /**
   * Heatmap points were durably written. Published by the ingest flush after the
   * upsert succeeds, per website — not on enqueue, and never for a chunk whose
   * write failed.
   *
   * Carries only `websiteId`: the tracker sends the website UUID with heatmap
   * events and `heatmap_points` is keyed by it, so the publisher has no `siteId`
   * to hand over without a lookup it does not otherwise need.
   */
  "heatmap.data_collected": {
    /** `websites.id`. */
    websiteId: string;
    /** Points actually written, after in-batch duplicate cells were merged. */
    pointCount: number;
    occurredAt: Date;
  };

  /**
   * A page background image was stored. Carries `source` because the three
   * producers have very different trust and quality characteristics: `tracker` is
   * html2canvas output from the visitor's browser, `dashboard` is html2canvas from
   * an authenticated user, `playwright` is a server-side capture of the real page.
   *
   * Not published for a deduplicated or check-only capture — nothing was stored.
   */
  "heatmap.screenshot_captured": WebsiteRef & {
    /** Normalized page path, as `heatmap_page_snapshots` stores it. */
    pagePath: string;
    s3Key: string;
    source: "tracker" | "dashboard" | "playwright";
    occurredAt: Date;
  };

  /** Heatmap points for one or more pages were deleted, at a user's request. */
  "heatmap.pages_deleted": WebsiteRef & {
    /** The paths as requested; unknown ones simply matched nothing. */
    pagePaths: string[];
    occurredAt: Date;
  };

  // ─── funnels ─────────────────────────────────────────────────────────────
  "funnel.step_reached": {
    siteId: string;
    funnelId: string;
    visitorId: string;
    stepIndex: number;
    occurredAt: Date;
  };

  /**
   * Definition lifecycle. Carries both website identifiers because the interested
   * consumers are split across them: cache invalidation for the tracker's
   * `/init` payload keys on `websiteId`, while anything correlating against
   * `analytics_events` needs `siteId`. Resolving one from the other is a database
   * lookup the publisher has already done.
   */
  "funnel.created": WebsiteRef & {
    funnelId: string;
    name: string;
    /** Number of steps at creation — enough for usage metrics without the payload carrying the definition. */
    stepCount: number;
    occurredAt: Date;
  };

  "funnel.updated": WebsiteRef & {
    funnelId: string;
    /** Only the fields the patch actually set, in wire (snake_case) form. */
    changes: Record<string, unknown>;
    occurredAt: Date;
  };

  /**
   * Published once per funnel even when the delete was a bulk operation, so a
   * consumer never has to handle both a single and a batched shape.
   */
  "funnel.deleted": WebsiteRef & {
    funnelId: string;
    occurredAt: Date;
  };

  // ─── automations ─────────────────────────────────────────────────────────
  /**
   * An automation matched a trigger and fired.
   *
   * Delivered through the transactional outbox, enqueued in the same transaction
   * as the impression it belongs to — an automation firing is externally visible
   * (it can send a webhook) and is what frequency caps are charged against, so it
   * must not be lost. Outbox delivery is at-least-once: **dedupe on `runId`**,
   * which identifies one evaluation of one automation and is stable across
   * redeliveries.
   */
  "automation.triggered": {
    siteId: string;
    automationId: string;
    /** Correlates this firing with its `automation_events` rows. Idempotency key. */
    runId: string;
    /** The visitor's anonymous id — the only identity the tracker path always has. */
    visitorId: string;
    occurredAt: Date;
  };

  /**
   * One action of one automation run finished.
   *
   * Published straight to the bus, not outboxed: the outcome is already durably
   * recorded in `automation_events` for the dashboard, so this is a live signal
   * whose loss costs nothing, and it fires once per action.
   */
  "automation.action_executed": {
    siteId: string;
    automationId: string;
    runId: string;
    /** Action position within the definition, e.g. `webhook_0`. */
    actionKey: string;
    status: "success" | "failed";
    durationMs: number;
    occurredAt: Date;
  };
}

/** Every valid event name. */
export type EventName = keyof EventMap;

/** The payload for a given event name. */
export type EventPayload<K extends EventName> = EventMap[K];
