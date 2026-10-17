import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash"),
    name: varchar("name", { length: 255 }).notNull().default(""),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    avatarUrl: text("avatar_url"),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    loginCount: integer("login_count").notNull().default(0),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    googleId: text("google_id"),
    githubId: text("github_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * An account's own customers — an agency's clients, or a platform's tenants — each
 * grouping some of that account's websites (047).
 *
 * `external_id` is the caller's identifier for the tenant. It is unique per owner so a
 * signup handler that retries `POST /manage/clients` gets the client it already made
 * rather than a second one.
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    externalId: text("external_id"),
    company: text("company").notNull().default(""),
    email: text("email").notNull().default(""),
    websiteUrl: text("website_url").notNull().default(""),
    note: text("note").notNull().default(""),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    /**
     * Per-feature switches, `{ replays: false, … }`. A key that is absent is on. Applied on
     * top of each site's own flags when the tracker resolves the site.
     */
    featuresEnabled: jsonb("features_enabled").$type<Record<string, boolean>>().notNull().default({}),
    /**
     * Per-client caps, `{ max_monthly_events: 10000, … }`; absent or null is uncapped.
     * `max_websites` is enforced here; the usage caps by the gateway's ingest quota.
     */
    limits: jsonb("limits").$type<Record<string, number | null>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_clients_user_id").on(t.userId),
    uniqueIndex("ux_clients_user_external_id")
      .on(t.userId, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
  ],
);

export const websites = pgTable(
  "websites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    trackingId: text("tracking_id").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    automationEnabled: boolean("automation_enabled").notNull().default(true),
    funnelEnabled: boolean("funnel_enabled").notNull().default(true),
    errorsEnabled: boolean("errors_enabled").notNull().default(true),
    heatmapEnabled: boolean("heatmap_enabled").notNull().default(true),
    heatmapIncludePatterns: text("heatmap_include_patterns"),
    heatmapExcludePatterns: text("heatmap_exclude_patterns"),
    heatmapLayoutEnabled: boolean("heatmap_layout_enabled").notNull().default(true),
    replayEnabled: boolean("replay_enabled").notNull().default(true),
    replaySamplingRate: real("replay_sampling_rate").notNull().default(1),
    replayIncludePatterns: text("replay_include_patterns"),
    replayExcludePatterns: text("replay_exclude_patterns"),
    /** Recordings and heatmap snapshots: every text node masked, everywhere (036). */
    maskAllText: boolean("mask_all_text").notNull().default(false),
    /** …or on the pages these newline-separated patterns match. */
    maskTextPatterns: text("mask_text_patterns").default("/account\n/profile\n/settings\n/checkout\n/billing\n/orders"),
    verificationToken: text("verification_token").notNull().default(""),
    publicShareId: text("public_share_id"),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>(),
    /** The owner's client this site belongs to, if any; cleared when the client is deleted (047). */
    clientId: uuid("client_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_websites_user_id").on(t.userId),
    index("ix_websites_tracking_id").on(t.trackingId),
    index("ix_websites_client_id").on(t.clientId),
    uniqueIndex("ix_websites_public_share_id").on(t.publicShareId),
  ],
);

/**
 * Durable ingest queue.
 *
 * The buffers in `CollectBuffer` are memory: anything not yet flushed dies with the
 * process, which is the durability trade `IngestFlusher` documents. This table moves the
 * boundary forward — the flush writes a row here instead of calling the module sinks, and
 * a worker claims and applies it. A crash now costs at most one in-flight batch rather
 * than every buffer.
 *
 * Modelled on `outbox`: claim, count attempts, and park a batch that exhausts them instead
 * of dropping it. That pattern is already proven here by `OutboxPublisher`, and it needs no
 * broker — which for a Postgres-and-MinIO stack is the difference between shipping this and
 * adding Kafka to run it.
 *
 * A claim is `claimed_at`, not a row lock. The two are not interchangeable: the claim query
 * is one autocommit statement, so a `FOR UPDATE` taken inside it is gone before the worker
 * applies anything. See that column.
 *
 * `partition_key` is what keeps ordering-sensitive work correct. Recordings must not be
 * applied concurrently within one session (chunk sequences are assigned per session), so
 * their key is the session id; everything else is commutative and keys on the website.
 * At most one batch per key is in flight, enforced by `ux_ingest_batches_one_inflight`.
 */
export const ingestBatches = pgTable(
  "ingest_batches",
  {
    /**
     * Content-derived, so a redelivery of the same rows reuses the row — see
     * `serializeBatch`. This row is also the exactly-once marker: `applyBatchOnce` flips
     * `completed_at` inside the write's own transaction, so a batch cannot be applied
     * twice. There used to be a second table for that; one fact only needs one row.
     */
    batchId: text("batch_id").primaryKey(),
    /** `analytics` | `funnels` | `automations` | `recordings` | `heatmaps`. */
    category: varchar("category", { length: 32 }).notNull(),
    /** Session id for recordings, website id otherwise. Serialises work within a key. */
    partitionKey: text("partition_key").notNull(),
    /** The batch itself, as the sink expects it. */
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    /** Rows in the payload, so a queue-depth query needs no jsonb inspection. */
    rowCount: integer("row_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /**
     * When a worker took this batch, and null when no one holds it.
     *
     * The claim, written down. It has to be: `claimPendingBatches` runs as one autocommit
     * statement, so the `FOR UPDATE SKIP LOCKED` it takes is released before the worker
     * has applied anything — a lock cannot outlive its statement. Without this column two
     * workers claimed the same row, and two batches for one partition key ran at once,
     * which is what assigns a replay session two conflicting chunk sequences.
     *
     * A lease, not a flag: a worker that dies mid-apply leaves it set, and the claim query
     * treats anything older than `CLAIM_LEASE_MS` as reclaimable. `markBatchFailed` clears
     * it so a retry does not wait out the lease.
     */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /**
     * Not-before time for the next claim, written by `markBatchFailed`. Grows
     * exponentially with `attempts`, so a short outage does not burn every retry in a
     * second. Null for a batch that has never failed. See `db/sql/067_ingest_batch_backoff.sql`.
     */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    /** Times the health sweep has given this parked batch a fresh set of attempts. Capped. */
    requeues: integer("requeues").notNull().default(0),
    /** Null while pending. Set once a worker has applied it. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The candidate scan: oldest pending batch per partition key, in one category. The
    // column order is the query's — `DISTINCT ON (partition_key) ORDER BY partition_key,
    // created_at` — which the previous (category, completed_at, created_at) index could
    // not serve at all, leaving a full sort of the backlog on a query that runs 5×/second.
    index("ix_ingest_batches_pending")
      .on(t.category, t.partitionKey, t.createdAt)
      .where(sql`completed_at IS NULL`),
    // "At most one batch per partition key in flight", as a constraint rather than a
    // property of the claim query — and the index the `leased` CTE reads. See
    // `db/sql/018_ingest_batch_lease.sql`.
    uniqueIndex("ux_ingest_batches_one_inflight")
      .on(t.category, t.partitionKey)
      .where(sql`completed_at IS NULL AND claimed_at IS NOT NULL`),
    // Pruning completed rows, and finding parked ones.
    index("ix_ingest_batches_completed").on(t.completedAt),
  ],
);


export const websiteMembers = pgTable(
  "website_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 32 }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.websiteId, t.userId),
    index("ix_website_members_user").on(t.userId),
    index("ix_website_members_website").on(t.websiteId),
  ],
);

export const websiteInvitations = pgTable(
  "website_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("viewer"),
    token: text("token").notNull(),
    invitedBy: uuid("invited_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ix_website_invitations_token").on(t.token),
    index("ix_website_invitations_website").on(t.websiteId),
    index("ix_website_invitations_email").on(t.email),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    name: text("name").notNull(),
    type: varchar("type", { length: 32 }).notNull().default("event"),
    identifier: text("identifier").notNull(),
    selector: text("selector"),
    revenue: real("revenue"),
    currency: varchar("currency", { length: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_goals_website_id").on(t.websiteId)],
);

export const funnels = pgTable(
  "funnels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    steps: jsonb("steps").notNull().$type<Record<string, unknown>[]>(),
    /** Hours allowed between one step and the next; null is no limit. */
    conversionWindowHours: integer("conversion_window_hours"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_funnels_website_id").on(t.websiteId),
    index("ix_funnels_website_active").on(t.websiteId, t.isActive),
  ],
);

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    definition: jsonb("definition").notNull().$type<Record<string, unknown>>(),
    isActive: boolean("is_active").notNull().default(true),
    priority: integer("priority").notNull().default(50),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_automations_website_id").on(t.websiteId),
    index("ix_automations_website_active").on(t.websiteId, t.isActive),
  ],
);

/**
 * Automation lifecycle log: triggers, server runs, per-action rows, failures (not “executions” only).
 *
 * - `record_type`: **client_trigger** = tracker matched conditions; **server_run** = backend accepted work;
 *   **action** = single side-effect (webhook, email, …); **action_retry** optional for retries.
 * - `status`: **triggered** (client only), **pending** | **running** | **success** | **failed** | **skipped** | **partial**
 *   for server/actions. Extend as your worker adds real execution.
 * - `run_id`: correlates trigger + downstream rows for the same “run” (set on ingest for new triggers).
 * - `detail`: full payload (props, provider response snippets, etc.); indexed fields above support filters & dashboards.
 *
 * DB table: `automation_events`. Upgrades from `automation_executions`: see `db/sql/005_rename_automation_executions_to_events.sql`.
 */
export const automationEvents = pgTable(
  "automation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id").notNull(),
    /** client_trigger | server_run | action | action_retry */
    recordType: varchar("record_type", { length: 32 }).notNull().default("client_trigger"),
    /** Tracker rule source event, e.g. pageview (denormalized from detail). */
    triggerEvent: varchar("trigger_event", { length: 128 }),
    /** Correlates all rows for one automation run. */
    runId: uuid("run_id"),
    status: varchar("status", { length: 32 }).notNull(),
    visitorId: text("visitor_id"),
    sessionId: text("session_id"),
    pageUrl: text("page_url"),
    /** Optional action key inside definition (e.g. webhook_0) when record_type = action. */
    actionKey: varchar("action_key", { length: 64 }),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_automation_events_automation_created").on(t.automationId, t.createdAt),
    index("ix_automation_events_automation_status_created").on(
      t.automationId,
      t.status,
      t.createdAt,
    ),
    index("ix_automation_events_run_id").on(t.runId),
    index("ix_automation_events_record_type").on(t.automationId, t.recordType, t.createdAt),
  ],
);

/** Pageviews & custom events (Postgres-native analytics). */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * `text`, not `uuid`. The deployed column is `text` — `007_analytics_partitioned.sql`
     * creates it that way and `003` renamed it from `website_site_id` without changing the
     * type — and this declaration said `uuid`. Harmless while Drizzle emits no cast, but a
     * `drizzle-kit push` would have tried to alter a populated, partitioned column. Same
     * drift, and the same reasoning, as `session_replays.website_id`.
     */
    websiteId: text("website_id").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    page: text("page"),
    visitorId: text("visitor_id"),
    sessionId: text("session_id"),
    properties: jsonb("properties").$type<Record<string, unknown>>(),
    referrer: text("referrer"),
    country: varchar("country", { length: 2 }),
    region: text("region"),
    city: text("city"),
    browser: text("browser"),
    device: text("device"),
    os: text("os"),
    language: text("language"),
    screenWidth: integer("screen_width"),
    screenHeight: integer("screen_height"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    /** Traffic channel, classified at ingest for pageviews — see `lib/traffic-channel.ts`. */
    channel: varchar("channel", { length: 16 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_analytics_site_occurred").on(t.websiteId, t.occurredAt),
    index("ix_analytics_site_type_occurred").on(t.websiteId, t.eventType, t.occurredAt),
  ],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_api_keys_website_id").on(t.websiteId),
    index("ix_api_keys_key_prefix").on(t.keyPrefix),
  ],
);

/**
 * Account-level keys for the management API (047).
 *
 * `api_keys` are per website and read-only. These act for the account that minted them:
 * creating clients and websites from a signup handler, where no dashboard session exists.
 */
export const accountApiKeys = pgTable(
  "account_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_account_api_keys_user_id").on(t.userId),
    index("ix_account_api_keys_key_prefix").on(t.keyPrefix),
  ],
);

/**
 * Permanent, revocable embed links (048): one website's analytics, or all of a client's,
 * in an iframe. The URL's token is signed from `id` and never stored; verifying it checks
 * the signature and that this row is not revoked. A target has at most one live link.
 */
export const embedLinks = pgTable(
  "embed_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    websiteId: uuid("website_id").references(() => websites.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** Sections the link exposes (049); read at verification time. */
    sections: text("sections").array().notNull().default(sql`'{analytics}'::text[]`),
  },
  (t) => [
    index("ix_embed_links_owner_id").on(t.ownerId),
    uniqueIndex("ux_embed_links_website_live")
      .on(t.websiteId)
      .where(sql`${t.websiteId} IS NOT NULL AND ${t.revokedAt} IS NULL`),
    uniqueIndex("ux_embed_links_client_live")
      .on(t.clientId)
      .where(sql`${t.clientId} IS NOT NULL AND ${t.revokedAt} IS NULL`),
    check("ck_embed_links_one_target", sql`(${t.websiteId} IS NULL) <> (${t.clientId} IS NULL)`),
    check(
      "ck_embed_links_sections",
      sql`cardinality(${t.sections}) > 0 AND ${t.sections} <@ ARRAY['analytics','recordings','heatmaps']::text[]`,
    ),
  ],
);

/** An agency's brand, shown to its clients on the portal and on embeds (068, 069). No row = defaults. */
export const agencyWhiteLabel = pgTable(
  "agency_white_label",
  {
    ownerId: uuid("owner_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    brandName: varchar("brand_name", { length: 80 }).notNull().default(""),
    logoUrl: varchar("logo_url", { length: 1024 }).notNull().default(""),
    primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#6366f1"),
    supportEmail: varchar("support_email", { length: 320 }).notNull().default(""),
    footerText: varchar("footer_text", { length: 200 }).notNull().default(""),
    hideSeentics: boolean("hide_seentics").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ck_agency_white_label_color", sql`${t.primaryColor} ~ '^#[0-9a-f]{6}$'`),
    check("ck_agency_white_label_logo", sql`${t.logoUrl} = '' OR ${t.logoUrl} LIKE 'https://%'`),
  ],
);

/** A client's contact with read-only portal access to that one client (068). No password. */
export const agencyClientUsers = pgTable(
  "agency_client_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Lower-cased on write, so the unique index is case-insensitive. */
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 120 }).notNull().default(""),
    /** invited | active | revoked */
    status: varchar("status", { length: 16 }).notNull().default("invited"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("ux_agency_client_users_client_email").on(t.clientId, t.email),
    index("ix_agency_client_users_owner").on(t.ownerId, t.createdAt),
    check("ck_agency_client_users_status", sql`${t.status} IN ('invited', 'active', 'revoked')`),
  ],
);

/** Client portal links (068). Only the token's SHA-256 is stored; the token is shown once. */
export const agencyPortalTokens = pgTable(
  "agency_portal_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** `null` for the anonymous whole-client link the dashboard's "Generate link" makes. */
    clientUserId: uuid("client_user_id").references(() => agencyClientUsers.id, { onDelete: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_agency_portal_tokens_hash").on(t.tokenHash),
    index("ix_agency_portal_tokens_client_live").on(t.clientId).where(sql`${t.revokedAt} IS NULL`),
    index("ix_agency_portal_tokens_client_user").on(t.clientUserId).where(sql`${t.clientUserId} IS NOT NULL`),
  ],
);

/** Session replay metadata (chunks / bundles may live in S3). */
export const sessionReplays = pgTable(
  "session_replays",
  {
    /**
     * `text`, not `uuid`. Every deployed database has this column as text, and the
     * declaration said `uuid` — harmless while Drizzle emits no cast, but a
     * `drizzle-kit push` would have tried to alter a populated column to a type its
     * historical values do not all satisfy.
     */
    websiteId: text("website_id").notNull(),
    sessionId: text("session_id").notNull(),
    sequence: integer("sequence").notNull(),
    data: jsonb("data").notNull().$type<Record<string, unknown>>(),
    browser: text("browser").notNull().default(""),
    device: text("device").notNull().default(""),
    os: text("os").notNull().default(""),
    country: text("country").notNull().default(""),
    entryPage: text("entry_page").notNull().default(""),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    pagesViewed: integer("pages_viewed").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    hasRageClicks: boolean("has_rage_clicks").notNull().default(false),
    hasErrors: boolean("has_errors").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.websiteId, t.sessionId, t.sequence] }),
    index("ix_session_replays_site_seq_ts").on(t.websiteId, t.sequence, t.timestamp),
  ],
);

/**
 * Frustration signals and the summary for one recorded session — see
 * db/sql/055_session_analyses.sql, which also owns its indexes (partial and descending,
 * so they are not declared here) and the trigger deleting a row with its recording.
 * Owned by the recordings module (`services/session-analysis.service.ts`).
 */
export const sessionAnalyses = pgTable(
  "session_analyses",
  {
    websiteId: text("website_id").notNull(),
    sessionId: text("session_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 12 }).notNull().default("ready"),
    frustrationScore: smallint("frustration_score").notNull().default(0),
    signalCounts: jsonb("signal_counts").notNull().$type<Record<string, number>>().default({}),
    signals: jsonb("signals").notNull().$type<unknown[]>().default([]),
    timeline: jsonb("timeline").notNull().$type<Record<string, unknown>>().default({}),
    analyzedThroughMs: bigint("analyzed_through_ms", { mode: "number" }).notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    summarySource: varchar("summary_source", { length: 8 }),
    summaryModel: varchar("summary_model", { length: 100 }),
    summaryInputTokens: integer("summary_input_tokens").notNull().default(0),
    summaryOutputTokens: integer("summary_output_tokens").notNull().default(0),
    summaryCostUsd: numeric("summary_cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    summaryGeneratedAt: timestamp("summary_generated_at", { withTimezone: true }),
    summaryAnalysisAt: timestamp("summary_analysis_at", { withTimezone: true }),
    summaryAttemptedAt: timestamp("summary_attempted_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.websiteId, t.sessionId] })],
);

/**
 * Archived stylesheets that recordings and heatmap snapshots link to — see
 * db/sql/059_replay_stylesheets.sql, which owns the partial indexes and the status check.
 * Owned by the recordings module (`services/stylesheets/`).
 */
export const replayStylesheets = pgTable(
  "replay_stylesheets",
  {
    websiteId: text("website_id").notNull(),
    urlHash: char("url_hash", { length: 64 }).notNull(),
    url: text("url").notNull(),
    status: varchar("status", { length: 12 }).notNull().default("pending"),
    storageKey: text("storage_key"),
    bytes: integer("bytes"),
    contentSha256: char("content_sha256", { length: 64 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    attempts: smallint("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.websiteId, t.urlHash] }),
    check(
      "ck_replay_stylesheets_status",
      sql`${t.status} IN ('pending', 'stored', 'failed', 'too_large', 'not_css')`,
    ),
  ],
);

/** The stylesheet backfill's single cursor row — see db/sql/059_replay_stylesheets.sql. */
export const replayStylesheetBackfill = pgTable("replay_stylesheet_backfill", {
  id: smallint("id").primaryKey().default(1),
  cursorTs: timestamp("cursor_ts", { withTimezone: true }).notNull(),
  cursorWebsiteId: text("cursor_website_id").notNull().default(""),
  cursorSessionId: text("cursor_session_id").notNull().default(""),
  floorTs: timestamp("floor_ts", { withTimezone: true }).notNull(),
  sessionsScanned: integer("sessions_scanned").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/**
 * The daily dashboard insight for one website and UTC day — see db/sql/052_ai_insights.sql.
 * Owned by the AI module (`modules/ai/insights`).
 */
export const aiInsights = pgTable(
  "ai_insights",
  {
    websiteId: uuid("website_id").notNull(),
    insightDate: date("insight_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    source: varchar("source", { length: 8 }).notNull().default("rules"),
    lines: jsonb("lines").notNull().$type<unknown[]>().default([]),
    signals: jsonb("signals").notNull().$type<unknown[]>().default([]),
    reason: text("reason"),
    model: varchar("model", { length: 100 }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.websiteId, t.insightDate] })],
);

/**
 * Suggestions, what was done about them and what changed afterwards — see
 * db/sql/058_ai_recommendations.sql. Owned by the AI module (`modules/ai/recommendations`).
 */
export const aiRecommendations = pgTable(
  "ai_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    source: varchar("source", { length: 16 }).notNull(),
    sourceRef: text("source_ref"),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    rationale: text("rationale").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    target: jsonb("target").notNull().$type<Record<string, unknown>>().default({}),
    metric: jsonb("metric").notNull().$type<Record<string, unknown>>().default({}),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    baseline: jsonb("baseline").$type<Record<string, unknown>>(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    appliedBy: uuid("applied_by"),
    appliedVia: varchar("applied_via", { length: 16 }),
    resource: jsonb("resource").$type<Record<string, unknown>>(),
    queryId: uuid("query_id"),
    impact: jsonb("impact").$type<Record<string, unknown>>(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ux_ai_recommendations_website_key").on(t.websiteId, t.dedupeKey),
    index("ix_ai_recommendations_website_status").on(t.websiteId, t.status, t.updatedAt),
  ],
);

/**
 * Plain-English findings for one page's heatmap, per device and window — see
 * db/sql/056_ai_heatmap_insights.sql. Owned by the AI module (`modules/ai/heatmap-insights`).
 */
export const aiHeatmapInsights = pgTable(
  "ai_heatmap_insights",
  {
    websiteId: uuid("website_id").notNull(),
    pagePath: text("page_path").notNull(),
    device: varchar("device", { length: 10 }).notNull(),
    days: integer("days").notNull(),
    source: varchar("source", { length: 8 }).notNull().default("rules"),
    findings: jsonb("findings").notNull().$type<unknown[]>().default([]),
    signals: jsonb("signals").notNull().$type<unknown[]>().default([]),
    signalKey: text("signal_key").notNull().default(""),
    reason: text("reason"),
    model: varchar("model", { length: 100 }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.websiteId, t.pagePath, t.device, t.days] }),
    index("ix_ai_heatmap_insights_website_created").on(t.websiteId, t.createdAt),
  ],
);

/**
 * Anomaly alerts: one row per incident the hourly check found — see db/sql/057_ai_anomalies.sql.
 * Owned by the AI module (`modules/ai/anomalies`). At most one open row per site, type and subject.
 */
export const aiAnomalies = pgTable(
  "ai_anomalies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    subject: text("subject").notNull().default(""),
    status: varchar("status", { length: 10 }).notNull().default("open"),
    severity: varchar("severity", { length: 10 }).notNull(),
    metric: varchar("metric", { length: 20 }).notNull(),
    observed: doublePrecision("observed").notNull().default(0),
    expected: doublePrecision("expected").notNull().default(0),
    score: doublePrecision("score").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    explanation: text("explanation"),
    explanationSource: varchar("explanation_source", { length: 8 }),
    path: varchar("path", { length: 100 }).notNull().default(""),
    facts: jsonb("facts").notNull().$type<Record<string, unknown>>().default({}),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: varchar("resolution", { length: 12 }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    notifyStatus: varchar("notify_status", { length: 20 }),
    resolvedNotifiedAt: timestamp("resolved_notified_at", { withTimezone: true }),
    model: varchar("model", { length: 100 }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  },
  (t) => [
    uniqueIndex("ux_ai_anomalies_open").on(t.websiteId, t.type, t.subject).where(sql`status = 'open'`),
    index("ix_ai_anomalies_website_detected").on(t.websiteId, t.detectedAt.desc()),
  ],
);

/** Per-site anomaly alert settings — see db/sql/057_ai_anomalies.sql. No row: enabled, normal. */
export const aiAnomalySettings = pgTable("ai_anomaly_settings", {
  websiteId: uuid("website_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  sensitivity: varchar("sensitivity", { length: 10 }).notNull().default("normal"),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Anomaly alert snoozes — see db/sql/060_ai_anomaly_snoozes.sql. `type` and `subject` may be '*'
 * (every type, every subject). Owned by the AI module.
 */
export const aiAnomalySnoozes = pgTable(
  "ai_anomaly_snoozes",
  {
    websiteId: uuid("website_id").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    subject: text("subject").notNull(),
    until: timestamp("until", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.websiteId, t.type, t.subject] }),
    index("ix_ai_anomaly_snoozes_until").on(t.until),
  ],
);

/** Aggregated heatmap cells per page / device / position. */
export const heatmapPoints = pgTable(
  "heatmap_points",
  {
    websiteId: uuid("website_id").notNull(),
    pagePath: text("page_path").notNull(),
    eventType: text("event_type").notNull(),
    deviceType: text("device_type").notNull(),
    xPercent: integer("x_percent").notNull(),
    yPercent: integer("y_percent").notNull(),
    intensity: integer("intensity").notNull().default(1),
    targetSelector: text("target_selector").notNull().default(""),
    capVw: integer("cap_vw"),
    capVh: integer("cap_vh"),
    pageVersion: text("page_version").notNull().default(""),
    targetLocator: jsonb("target_locator").$type<Record<string, unknown>>(),
    targetRect: jsonb("target_rect").$type<Record<string, unknown>>(),
    relativeX: real("relative_x"),
    relativeY: real("relative_y"),
    positionMode: text("position_mode").notNull().default("normal"),
    clientX: real("client_x"),
    clientY: real("client_y"),
    pageX: real("page_x"),
    pageY: real("page_y"),
    scrollX: real("scroll_x"),
    scrollY: real("scroll_y"),
    documentWidth: integer("document_width"),
    documentHeight: integer("document_height"),
    devicePixelRatio: real("device_pixel_ratio"),
    trackerVersion: text("tracker_version").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
    /** UTC day the clicks in this row happened — one row per cell per day (db/sql/046). */
    day: date("day").notNull().default(sql`((now() AT TIME ZONE 'UTC')::date)`),
  },
  (t) => [
    uniqueIndex("heatmap_points_cell_uq").on(
      t.websiteId,
      t.pagePath,
      t.eventType,
      t.deviceType,
      t.xPercent,
      t.yPercent,
      t.targetSelector,
      t.pageVersion,
      t.day,
    ),
    index("ix_heatmap_points_website_day").on(t.websiteId, t.day),
    index("ix_heatmap_points_website_page_event_day").on(t.websiteId, t.pagePath, t.eventType, t.day),
  ],
);

/** AI-generated analytics queries — each row is one user prompt + generated SQL + result metadata. */
export const aiQueries = pgTable(
  "ai_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    websiteId: uuid("website_id").notNull(),
    prompt: text("prompt").notNull(),
    systemContext: text("system_context"),
    generatedSql: text("generated_sql"),
    vizType: varchar("viz_type", { length: 32 }),
    title: text("title"),
    insight: text("insight"),
    tips: text("tips"),
    componentCode: text("component_code"),
    xKey: text("x_key"),
    yKey: text("y_key"),
    columns: jsonb("columns").$type<Array<{ key: string; label: string }>>(),
    rowCount: integer("row_count"),
    model: varchar("model", { length: 64 }).notNull().default("gpt-4o-mini"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostUsd: real("estimated_cost_usd"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    executionTimeMs: integer("execution_time_ms"),
    /** Threads follow-ups to the question they build on. Null for a one-off. */
    conversationId: uuid("conversation_id"),
    /** The assistant's prose. `insight`/`title` describe a chart; this is the sentence. */
    answer: text("answer"),
    /** Which tools ran and with what — the audit trail for a feature that can draft changes. */
    toolCalls: jsonb("tool_calls").$type<Array<{ name: string; args: unknown }>>(),
    /** A draft awaiting approval. Read back at confirm time rather than trusted from the client. */
    proposal: jsonb("proposal").$type<Record<string, unknown>>(),
    proposalAppliedAt: timestamp("proposal_applied_at", { withTimezone: true }),
    /** The recommendation this chat was started from ("Do it"); db/sql/058. */
    recommendationId: uuid("recommendation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_ai_queries_conversation").on(t.conversationId, t.createdAt),
    index("ix_ai_queries_user_id").on(t.userId),
    index("ix_ai_queries_website_id").on(t.websiteId),
    index("ix_ai_queries_user_created").on(t.userId, t.createdAt),
  ],
);

/** Heatmap layout screenshot metadata (JPEG and/or HTML DOM snapshot in S3). */
export const heatmapPageSnapshots = pgTable(
  "heatmap_page_snapshots",
  {
    websiteId: uuid("website_id").notNull(),
    pagePath: text("page_path").notNull(),
    s3Key: text("s3_key").notNull(),
    contentSha256: text("content_sha256").notNull(),
    docWidth: integer("doc_width").notNull(),
    docHeight: integer("doc_height").notNull(),
    htmlS3Key: text("html_s3_key"),
    /**
     * Which device bucket this background was captured on — the same grain
     * `heatmap_points.device_type` uses. A responsive page reflows between buckets,
     * so a desktop capture cannot host mobile points: identical nx/ny land on
     * different elements. One row per (page, device).
     */
    deviceType: text("device_type").notNull().default("desktop"),
    domFingerprint: text("dom_fingerprint").notNull().default(""),
    /** The real page the background was captured on — for /orders/:id, which order. */
    sourcePath: text("source_path").notNull().default(""),
    /** Last time a visitor's capture confirmed this background, stored or not (db/sql/046). */
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("heatmap_page_snapshots_website_page_device_uq").on(
      t.websiteId,
      t.pagePath,
      t.deviceType,
    ),
    index("ix_heatmap_snapshots_website_updated").on(t.websiteId, t.updatedAt),
  ],
);

/** Immutable structural variants; the snapshots table above points at the canonical one. */
export const heatmapPageVersions = pgTable(
  "heatmap_page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    pagePath: text("page_path").notNull(),
    domFingerprint: text("dom_fingerprint").notNull(),
    deviceType: text("device_type").notNull(),
    viewportWidth: integer("viewport_width").notNull(),
    viewportHeight: integer("viewport_height").notNull(),
    htmlS3Key: text("html_s3_key"),
    contentSha256: text("content_sha256").notNull(),
    eventCount: integer("event_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("heatmap_page_versions_identity_uq").on(
      t.websiteId, t.pagePath, t.deviceType, t.domFingerprint,
    ),
    index("ix_heatmap_page_versions_lookup").on(
      t.websiteId, t.pagePath, t.deviceType, t.lastSeenAt,
    ),
  ],
);

export const automationImpressions = pgTable(
  "automation_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id").notNull(),
    anonymousId: text("anonymous_id").notNull(),
    userId: text("user_id"),
    websiteId: uuid("website_id").notNull(),
    sessionId: text("session_id").notNull(),
    shownAt: timestamp("shown_at", { withTimezone: true }).notNull().defaultNow(),
    actionTaken: text("action_taken"),
    variant: text("variant"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_auto_imp_auto_anon").on(t.automationId, t.anonymousId),
    // The other half of the frequency-cap lookup's `OR`. Without it the planner could
    // index only `automation_id` and then filter, reading every impression an automation
    // had ever accumulated on a request every visitor triggers. See
    // `db/sql/020_automation_impression_session_index.sql`.
    index("ix_auto_imp_auto_session").on(t.automationId, t.sessionId),
    index("ix_auto_imp_website").on(t.websiteId, t.shownAt),
  ],
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    anonymousId: text("anonymous_id").notNull(),
    userId: text("user_id"),
    properties: jsonb("properties").notNull().default({}).$type<Record<string, unknown>>(),
    computed: jsonb("computed").notNull().default({}).$type<Record<string, unknown>>(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    visitCount: integer("visit_count").notNull().default(1),
    totalPageViews: integer("total_page_views").notNull().default(0),
    country: text("country"),
    city: text("city"),
    device: text("device"),
    browser: text("browser"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ix_user_profiles_website_anon_uq").on(t.websiteId, t.anonymousId),
    index("ix_user_profiles_website_user").on(t.websiteId, t.userId),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id").notNull(),
    runId: uuid("run_id"),
    url: text("url").notNull(),
    statusCode: integer("status_code"),
    success: boolean("success"),
    attemptCount: integer("attempt_count").notNull().default(1),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    responseMs: integer("response_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_webhook_deliveries_auto").on(t.automationId, t.createdAt),
  ],
);

export const identityAliases = pgTable(
  "identity_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonymousId: text("anonymous_id").notNull(),
    userId: text("user_id").notNull(),
    websiteId: uuid("website_id").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ix_identity_aliases_anon_uq").on(t.anonymousId, t.websiteId),
    index("ix_identity_aliases_user").on(t.userId, t.websiteId),
  ],
);

/**
 * One row per distinct frontend fault on a site.
 *
 * Maintained on ingest rather than derived at read time. Grouping `error_events` by
 * fingerprint on every dashboard load is the same mistake the analytics reads make —
 * a full scan for a figure that changes by one row at a time — and this table is read
 * far more often than it is written. It also means the list survives the raw events:
 * `error_events` is purged on the retention cron, the groups and their counts are not,
 * so "first seen three months ago, 12k times" stays true after the samples expire.
 */
export const errorGroups = pgTable(
  "error_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    /** sha256 of the normalised message and source. Computed server-side — see `fingerprint.ts`. */
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    /** `error` (window.onerror) or `unhandledrejection`. */
    kind: varchar("kind", { length: 32 }).notNull().default("error"),
    /** Representative text, refreshed to the most recent occurrence. */
    message: text("message").notNull(),
    sourceFile: text("source_file").notNull().default(""),
    lineNo: integer("line_no"),
    colNo: integer("col_no"),
    /** unresolved | resolved | ignored */
    status: varchar("status", { length: 16 }).notNull().default("unresolved"),
    eventCount: integer("event_count").notNull().default(0),
    /** Where it was last thrown, so the list can show a route without joining. */
    lastPagePath: text("last_page_path").notNull().default(""),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The upsert target. Ingest raises counts through this, so it has to be unique.
    uniqueIndex("error_groups_fingerprint_uq").on(t.websiteId, t.fingerprint),
    index("ix_error_groups_website_status_seen").on(t.websiteId, t.status, t.lastSeen),
  ],
);

/**
 * Individual occurrences, kept as samples behind their group.
 *
 * `sessionId` is the point of the whole feature: it joins an error to the replay of the
 * visitor who hit it, which is the thing a standalone error tracker cannot do. Retention
 * is deliberately short — the counts live on the group, and nobody debugs a fault from a
 * ten-week-old sample.
 */
export const errorEvents = pgTable(
  "error_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id").notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    message: text("message").notNull(),
    /** Truncated at the tracker; may be empty when the browser withholds it (cross-origin). */
    stack: text("stack").notNull().default(""),
    sourceFile: text("source_file").notNull().default(""),
    lineNo: integer("line_no"),
    colNo: integer("col_no"),
    pagePath: text("page_path").notNull().default(""),
    sessionId: text("session_id"),
    visitorId: text("visitor_id"),
    browser: text("browser").notNull().default(""),
    os: text("os").notNull().default(""),
    deviceType: text("device_type").notNull().default(""),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_error_events_website_occurred").on(t.websiteId, t.occurredAt),
    index("ix_error_events_group_occurred").on(t.websiteId, t.fingerprint, t.occurredAt),
  ],
);

/**
 * One form submission, listed on the submitting popup's automation page. Mirrors
 * `sql/053_form_submissions.sql`; keep them in step. Aged out after 90 days.
 */
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id"),
    variant: varchar("variant", { length: 64 }),
    /** Stored lower-cased and trimmed. */
    email: varchar("email", { length: 254 }).notNull(),
    name: varchar("name", { length: 200 }).notNull().default(""),
    phone: varchar("phone", { length: 50 }).notNull().default(""),
    consent: boolean("consent").notNull().default(false),
    fields: jsonb("fields").notNull().default({}),
    prize: jsonb("prize"),
    pageUrl: text("page_url").notNull().default(""),
    referrer: text("referrer").notNull().default(""),
    sessionId: text("session_id"),
    anonymousId: text("anonymous_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_form_submissions_form_created").on(t.websiteId, t.automationId, t.createdAt),
    index("ix_form_submissions_website_created").on(t.websiteId, t.createdAt),
    index("ix_form_submissions_website_email").on(t.websiteId, t.email),
  ],
);

/*
 * `contacts` (sql/064_contacts.sql) is deliberately NOT declared here. On a fresh database the
 * schema's tables are created before the SQL migrations run, and 050 still creates an older
 * `contacts` (with an index on a column the new one lacks) that 053 later drops: a new-shape
 * table made here first would make 050 fail on every new install. The leads module reads it
 * with raw SQL only.
 */

/** The prize an email won from a popup. Keyed by a hash of the address: no address is stored. */
export const formPrizes = pgTable(
  "form_prizes",
  {
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id").notNull(),
    emailHash: char("email_hash", { length: 64 }).notNull(),
    prize: jsonb("prize").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.websiteId, t.automationId, t.emailHash] })],
);

/**
 * One destination on one website; several per website, even of one provider.
 * Mirrors `sql/051_integrations.sql` and `053`.
 *
 * `credentials` is ciphertext, never plaintext — see `modules/integrations/lib/vault.ts`.
 */
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull().default(""),
    credentials: text("credentials").notNull(),
    credentialsHint: varchar("credentials_hint", { length: 8 }).notNull().default(""),
    config: jsonb("config").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    /** active | error */
    status: varchar("status", { length: 16 }).notNull().default("active"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastError: text("last_error"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ix_integration_connections_website").on(t.websiteId, t.createdAt)],
);

/** The delivery outbox: one row per (destination, submission). */
export const integrationDeliveries = pgTable(
  "integration_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").notNull(),
    automationId: uuid("automation_id"),
    payload: jsonb("payload"),
    /** pending | success | failed | skipped */
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    httpStatus: integer("http_status"),
    error: text("error"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("integration_deliveries_connection_submission_uq").on(t.connectionId, t.submissionId),
    index("ix_integration_deliveries_website_created").on(t.websiteId, t.createdAt),
    index("ix_integration_deliveries_submission").on(t.submissionId),
  ],
);
