/**
 * The agency API's shapes (`/api/v1/agency/*`), exactly as they come over the wire: snake_case,
 * the same as the examples in `agency-api-spec.ts` and what an API-key caller sees. The workspace
 * reads them as they are, so the reference and the dashboard can never drift apart.
 */

// ─── Envelope ─────────────────────────────────────────────────────────────────

export interface PageInfo {
  next_cursor: string | null;
  has_more: boolean;
}

export interface ListResponse<T> {
  data: T[];
  page: PageInfo;
}

export type AgencyErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'agency_plan_required'
  | 'not_found'
  | 'validation_failed'
  | 'conflict'
  | 'cap_exceeds_pool'
  | 'idempotency_conflict'
  | 'rate_limited'
  | 'provider_error'
  | 'feature_not_allowed';

export interface AgencyErrorBody {
  error: { code: AgencyErrorCode | string; message: string; details?: unknown; request_id?: string };
}

// ─── Resources ────────────────────────────────────────────────────────────────

/** The four things an Agency pool holds, counted per UTC month. */
export interface ResourceCounts {
  events: number;
  recordings: number;
  leads: number;
  ai_analyses: number;
}

export type Resource = keyof ResourceCounts;

// ─── Clients ──────────────────────────────────────────────────────────────────

export type ClientStatus = 'active' | 'suspended' | 'archived';

/** What the client's websites collect (separate from what the client may see: `ClientFeatures`). */
export type CollectFeature = 'analytics' | 'heatmaps' | 'replays' | 'funnels' | 'automations' | 'errors';

export interface Client {
  id: string;
  name: string;
  company: string;
  notes: string;
  status: ClientStatus;
  website_count: number;
  collect_features: Record<CollectFeature, boolean>;
  created_at: string;
  updated_at: string;
}

/** `GET /agency/clients/:id` (and every client write): the client with its websites. */
export type ClientDetail = Client & { websites: AgencyWebsite[] };

export interface ClientInput {
  name?: string;
  company?: string;
  notes?: string;
}

export interface ClientListFilters {
  status?: ClientStatus;
  q?: string;
}

// ─── Websites ─────────────────────────────────────────────────────────────────

export interface AgencyWebsite {
  id: string;
  client_id: string | null;
  name: string;
  url: string;
  tracking_id: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebsiteInput {
  name: string;
  url: string;
  client_id?: string | null;
}

export type WebsitePatch = Partial<WebsiteInput>;

export interface WebsiteListFilters {
  client_id?: string;
  unassigned?: boolean;
  q?: string;
}

export type VerificationStatus = 'receiving' | 'not_seen' | 'stale';

export interface Verification {
  status: VerificationStatus;
  is_verified: boolean;
  last_event_at: string | null;
  events_24h: number;
}

export type InstallMethod = 'html' | 'gtm' | 'nextjs' | 'wordpress' | 'shopify' | 'npm';

/** One line on how to install, and the docs page with the rest. */
export interface InstallInstruction {
  summary: string;
  docs_url: string;
}

export interface WebsiteInstall {
  website_id: string;
  tracking_id: string;
  script_url: string;
  snippet_html: string;
  instructions: Record<InstallMethod, InstallInstruction>;
  verification: Verification;
}

/**
 * A website just created: adding it to a client answers its install too (`{ website, install }`,
 * read as one by `addClientWebsite`); `POST /agency/websites` answers the site alone.
 */
export type CreatedWebsite = AgencyWebsite & { install?: WebsiteInstall };

// ─── Feature visibility ───────────────────────────────────────────────────────

/** Every dashboard page a client can be shown; the order is `FEATURES` in `constants.ts`. */
export type FeatureId =
  | 'overview' | 'events' | 'paths' | 'revenue' | 'recordings' | 'heatmaps' | 'funnels'
  | 'goals' | 'automations' | 'leads' | 'conversions' | 'ai' | 'errors' | 'privacy';
export type FeatureAccess = 'off' | 'view' | 'edit';
export type ClientFeatures = Record<FeatureId, FeatureAccess>;

// ─── Client users ─────────────────────────────────────────────────────────────

export type ClientUserStatus = 'invited' | 'active' | 'disabled';

/** A person who signs in to the client's dashboard with an email link. */
export interface ClientUser {
  id: string;
  email: string;
  name: string;
  status: ClientUserStatus;
  invited_at: string;
  last_seen_at: string | null;
}

export interface ClientUserInput {
  email: string;
  name?: string;
}

export interface ClientUserPatch {
  status?: ClientUserStatus;
  name?: string;
}

// ─── Branding & domain ────────────────────────────────────────────────────────

export interface Branding {
  brand_name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  footer_text: string;
  hide_seentics: boolean;
  /** The agency's sign-in name on seentics.com; `null` clears it. */
  slug: string | null;
  updated_at?: string | null;
}

export type BrandingInput = Omit<Branding, 'updated_at'>;

export type DomainState = 'pending_dns' | 'pending_certificate' | 'active' | 'failed';

export interface Domain {
  hostname: string;
  state: DomainState;
  reason: string | null;
  cname_target: string;
  ownership_verification: { name: string; type: string; value: string } | null;
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
}

// ─── Embeds ───────────────────────────────────────────────────────────────────

export type EmbedScope = 'website' | 'client';
export type EmbedSection = 'analytics' | 'recordings' | 'heatmaps';

export interface Embed {
  id: string;
  scope: EmbedScope;
  target_id: string;
  target_name: string;
  token: string;
  embed_url: string;
  sections: EmbedSection[];
  created_at: string;
}

export interface EmbedInput {
  scope: EmbedScope;
  target_id: string;
  sections?: EmbedSection[];
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export interface Usage {
  period: { start: string; end: string };
  pool: ResourceCounts;
  used: ResourceCounts;
  allocated: ResourceCounts;
  unallocated: ResourceCounts;
  overage: ResourceCounts;
}

/** Per resource; each `null` while nothing is allocated (every cap is `null` until caps arrive). */
export type Caps = Record<Resource, number | null>;

export interface UsageRow {
  id: string;
  name: string;
  used: ResourceCounts;
  cap: Caps;
  /** Share of each cap used, in percent; `null` where there is no cap. */
  pct: Caps;
  /** Website rows only. */
  client_id?: string | null;
}

// ─── Overview & setup ─────────────────────────────────────────────────────────

export type OverviewPeriod = '7d' | '30d' | '90d';
export type OverviewMetric = 'visitors' | 'pageviews' | 'events' | 'recordings' | 'revenue' | 'leads' | 'conversions';
/** Only the metrics the server could count are present. */
export type MetricTotals = Partial<Record<OverviewMetric, number>>;

export interface OverviewClient {
  /** `null` for the row of websites in no client. */
  id: string | null;
  name: string;
  status: ClientStatus | null;
  website_count: number;
  totals: MetricTotals;
  previous_totals: MetricTotals;
}

export interface Mover {
  website_id: string;
  website_name: string;
  client_id: string | null;
  metric: 'visitors';
  current: number;
  previous: number;
  change_pct: number | null;
}

export type AlertKind = 'cap_80' | 'cap_100' | 'tracking_stopped';

export interface AgencyAlert {
  id: string;
  kind: AlertKind;
  client_id: string | null;
  website_id: string | null;
  resource: string;
  /** `YYYY-MM-DD`. */
  period: string;
  created_at: string;
  dismissed_at: string | null;
}

export interface Overview {
  period: { key: OverviewPeriod; start: string; end: string; previous_start: string; previous_end: string };
  totals: MetricTotals;
  previous_totals: MetricTotals;
  clients: OverviewClient[];
  top_movers: Mover[];
  alerts: AgencyAlert[];
  generated_at: string;
}

export type SetupStepId = 'branding' | 'first_client' | 'website_installed' | 'client_user' | 'features_limits';

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
}

export interface Setup {
  steps: SetupStep[];
  completed: number;
  total: number;
}
