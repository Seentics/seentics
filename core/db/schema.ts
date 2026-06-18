import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
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

export const websites = pgTable(
  "websites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id").notNull().unique(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    trackingId: text("tracking_id").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isVerified: boolean("is_verified").notNull().default(false),
    automationEnabled: boolean("automation_enabled").notNull().default(true),
    funnelEnabled: boolean("funnel_enabled").notNull().default(true),
    heatmapEnabled: boolean("heatmap_enabled").notNull().default(true),
    heatmapIncludePatterns: text("heatmap_include_patterns"),
    heatmapExcludePatterns: text("heatmap_exclude_patterns"),
    heatmapLayoutEnabled: boolean("heatmap_layout_enabled").notNull().default(true),
    replayEnabled: boolean("replay_enabled").notNull().default(true),
    replaySamplingRate: real("replay_sampling_rate").notNull().default(1),
    replayIncludePatterns: text("replay_include_patterns"),
    replayExcludePatterns: text("replay_exclude_patterns"),
    verificationToken: text("verification_token").notNull().default(""),
    publicShareId: text("public_share_id"),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_websites_user_id").on(t.userId),
    uniqueIndex("ix_websites_public_share_id").on(t.publicShareId),
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

/** Session replay metadata (chunks / bundles may live in S3). `website_id` matches tracker `site_id` or UUID string. */
export const sessionReplays = pgTable(
  "session_replays",
  {
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
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
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
    ),
    index("ix_heatmap_points_website_updated").on(t.websiteId, t.lastUpdated),
    index("ix_heatmap_points_website_page_event").on(t.websiteId, t.pagePath, t.eventType),
  ],
);

/** AI-generated analytics queries — each row is one user prompt + generated SQL + result metadata. */
export const aiQueries = pgTable(
  "ai_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    websiteId: text("website_id").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
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
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("heatmap_page_snapshots_website_page_uq").on(t.websiteId, t.pagePath),
    index("ix_heatmap_snapshots_website_updated").on(t.websiteId, t.updatedAt),
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
