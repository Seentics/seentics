import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
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
});

export const websites = pgTable("websites", {
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
  /** JSON settings blob for dashboard (allowed_origins, retention, etc.) */
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  (t) => [unique().on(t.websiteId, t.userId)],
);

export const goals = pgTable("goals", {
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
});

/** Funnel definitions; `steps` matches dashboard funnel step shape. */
export const funnels = pgTable("funnels", {
  id: uuid("id").primaryKey().defaultRandom(),
  websiteId: uuid("website_id").notNull(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  steps: jsonb("steps").notNull().$type<Record<string, unknown>[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  websiteId: uuid("website_id").notNull(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  definition: jsonb("definition").notNull().$type<Record<string, unknown>>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationExecutions = pgTable("automation_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  automationId: uuid("automation_id").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Pageviews & custom events (Postgres-native analytics). */
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  websiteSiteId: text("website_site_id").notNull(),
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
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  websiteId: uuid("website_id").notNull(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
