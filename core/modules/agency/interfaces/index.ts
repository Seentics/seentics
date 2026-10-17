/**
 * Public contracts for the agency module: the agency workspace's API (`/api/v1/agency`), the
 * agency's white label, and the ports other modules implement so its overview can count
 * their rows without touching their tables.
 *
 * Its own module because it owns its own data (`agency_white_label`, `client_members`,
 * `agency_alerts`) and vocabulary. Clients and websites stay in the websites module — a
 * client is a way of grouping websites — and reach this module only through
 * `ClientDirectory` and `OwnedWebsites`. Embed links stay in api-keys (`EmbedLinks`).
 *
 * Who the caller is was decided by the gateway: it authenticates a session or an account
 * API key, checks scopes and the Agency plan, and names the agency in `X-Agency-*` headers.
 * See `lib/gateway-context.ts`.
 */

import type { Hono } from "hono";
import type { AgencyVars } from "../lib/gateway-context";

// ─── White label ─────────────────────────────────────────────────────────────

export const DEFAULT_PRIMARY_COLOR = "#6366f1";

export type WhiteLabelSettings = {
  ownerId: string;
  brandName: string;
  /** `""` or an https URL. */
  logoUrl: string;
  /** `#rrggbb`, lower case. */
  primaryColor: string;
  supportEmail: string;
  footerText: string;
  hideSeentics: boolean;
  /** `[a-z0-9-]{3,40}`, unique across agencies: names the agency on seentics.com's client sign-in. */
  slug: string | null;
  /** `null` while the owner has never saved settings (the defaults are showing). */
  updatedAt: Date | null;
};

/** Absent leaves a field alone. Text fields clear with `""`, the slug with `null`. */
export type WhiteLabelPatch = Partial<Omit<WhiteLabelSettings, "ownerId" | "updatedAt">>;

/** Persistence for white-label settings: one row per owner. */
export interface WhiteLabelRepository {
  find(ownerId: string): Promise<WhiteLabelSettings | null>;
  /** Insert or replace the owner's whole row. `"slug_taken"` when another agency has the slug. */
  upsert(settings: WhiteLabelSettings): Promise<WhiteLabelSettings | "slug_taken">;
}

/** The brand as a client sees it — what embed responses carry. */
export type BrandView = {
  brand_name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  footer_text: string;
  hide_seentics: boolean;
};

/**
 * The read the embed API needs: an owner's brand, defaults when unset. Its own interface
 * because the embed API must not be able to change anyone's settings.
 */
export interface AgencyBranding {
  brandFor(ownerId: string): Promise<BrandView>;
}

export interface WhiteLabel extends AgencyBranding {
  /** The owner's settings, or the defaults when never saved. */
  get(ownerId: string): Promise<WhiteLabelSettings>;
  /** Throws `AgencyOperationError("slug_taken")`. */
  update(ownerId: string, patch: WhiteLabelPatch): Promise<WhiteLabelSettings>;
}

/** Why an agency operation was refused. Controllers map each to an error code. */
export type AgencyFailure = "slug_taken";

export class AgencyOperationError extends Error {
  constructor(readonly reason: AgencyFailure) {
    super(reason);
  }
}

// ─── Ports other modules implement ───────────────────────────────────────────

/** What the overview totals. Each is contributed by the module that owns the rows. */
export const OVERVIEW_METRICS = ["visitors", "pageviews", "events", "recordings", "revenue", "leads", "conversions"] as const;
export type OverviewMetric = (typeof OVERVIEW_METRICS)[number];
export type MetricTotals = Partial<Record<OverviewMetric, number>>;

/** UTC calendar days, both ends inclusive, `YYYY-MM-DD`. */
export type MetricWindow = { from: string; to: string };

/**
 * One module's figures for many sites over a window, in one batched read — the agency
 * overview renders every site an agency has, so a per-site call would be an N+1.
 *
 * The same inversion as `UsageCounter`: this module owns the overview's shape, each module
 * owns counting its own rows. A site with nothing in the window may be absent from the map.
 */
export interface SiteMetricSource {
  readonly metrics: readonly OverviewMetric[];
  totalsBySite(websiteIds: readonly string[], window: MetricWindow): Promise<Map<string, MetricTotals>>;
}

export type TrackingActivity = {
  /** When the site's tracker last sent anything; `null` when it never has. */
  lastEventAt: Date | null;
  /** Events in the last 24 hours. */
  events24h: number;
};

/** Whether sites' trackers are sending — the install screen's verification. Analytics implements it. */
export interface TrackingActivityReader {
  activity(websiteIds: readonly string[]): Promise<Map<string, TrackingActivity>>;
}

// ─── Workspace data ──────────────────────────────────────────────────────────

export const ALERT_KINDS = ["cap_80", "cap_100", "tracking_stopped"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export type AgencyAlert = {
  id: string;
  ownerId: string;
  clientId: string | null;
  websiteId: string | null;
  kind: AlertKind;
  resource: string;
  /** `YYYY-MM-DD`. */
  period: string;
  createdAt: Date;
  dismissedAt: Date | null;
};

/** Persistence for alerts. Every method is scoped to the owner. */
export interface AlertRepository {
  /** Undismissed, newest first. */
  listOpen(ownerId: string, limit: number): Promise<AgencyAlert[]>;
  /** Dismiss it (a dismissed one stays as it was); `null` when the owner has no such alert. */
  dismiss(ownerId: string, alertId: string): Promise<AgencyAlert | null>;
}

/** The setup guide's reads of tables this module does not otherwise query. */
export interface SetupSignalRepository {
  /** Whether any of the owner's clients has a member (`client_members`). */
  hasClientMember(ownerId: string): Promise<boolean>;
  /**
   * The owner's custom domain from the gateway's `agency_custom_domains`, read-only; `null`
   * when there is none or the table does not exist (self-hosted, no gateway).
   */
  customDomain(ownerId: string): Promise<{ hostname: string; state: string } | null>;
}

// ─── Workspace services, as the controllers see them ─────────────────────────

export const OVERVIEW_PERIODS = ["7d", "30d", "90d"] as const;
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export type ClientOverviewRow = {
  /** `null` for the sites in no client. */
  id: string | null;
  name: string;
  status: string | null;
  websiteCount: number;
  totals: MetricTotals;
  previous: MetricTotals;
};

export type Mover = {
  websiteId: string;
  websiteName: string;
  clientId: string | null;
  metric: "visitors";
  current: number;
  previous: number;
  /** `null` when the previous period had none: growth from zero has no percentage. */
  changePct: number | null;
};

export type AgencyOverview = {
  period: OverviewPeriod;
  window: MetricWindow;
  previousWindow: MetricWindow;
  /** Metrics with no module counting them are absent rather than reported as zero. */
  totals: MetricTotals;
  previous: MetricTotals;
  clients: ClientOverviewRow[];
  movers: Mover[];
  alerts: AgencyAlert[];
  generatedAt: Date;
};

export interface AgencyOverviewReader {
  /** Cached per owner and period for a minute. */
  overview(ownerId: string, period: OverviewPeriod): Promise<AgencyOverview>;
  dismissAlert(ownerId: string, alertId: string): Promise<AgencyAlert | null>;
}

export const SETUP_STEPS = ["branding", "first_client", "website_installed", "client_user", "features_limits"] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];

export interface AgencySetup {
  steps(ownerId: string): Promise<{ id: SetupStepId; done: boolean }[]>;
}

export const VERIFICATION_STATUSES = ["receiving", "not_seen", "stale"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type Verification = {
  status: VerificationStatus;
  isVerified: boolean;
  lastEventAt: Date | null;
  events24h: number;
};

export interface WebsiteVerification {
  /** The site's tracking state now. `recheck` also records a first sighting on the website. */
  check(ownerId: string, websiteId: string, opts?: { recheck?: boolean }): Promise<Verification | null>;
}

// ─── The module ──────────────────────────────────────────────────────────────

export interface AgencyModule {
  whiteLabel: WhiteLabel;
  /**
   * `/api/v1/agency/*`, behind the gateway: no session or key auth of its own, and every
   * request refused unless it carries the gateway's key. Mount at `/api/v1/agency`.
   */
  routes: Hono<{ Variables: AgencyVars }>;
}
