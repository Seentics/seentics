/**
 * Server-side conversions: the contracts.
 *
 * A conversion is a purchase, a lead, a sign-up or a custom event the owner mapped, from a
 * visitor who consented. Ingest hands this module the tracker's consented custom events
 * (`ConversionTrackerRow`, through the `conversions` lane) and the leads module hands it each
 * consented lead (through the lead sink). Each is queued for every enabled destination that
 * maps its kind, and the worker sends it.
 */

export const CONVERSION_PLATFORMS = ["meta", "ga4", "tiktok", "linkedin"] as const;
export type ConversionPlatform = (typeof CONVERSION_PLATFORMS)[number];
export type ConversionKind = "purchase" | "lead" | "sign_up" | "custom";
export type MatchKey = "click_id" | "email" | "phone" | "ip_ua" | "browser_id";

/** Click ids by URL parameter, each with when it was seen: `{ fbclid: { v, ts } }`. */
export type ClickIds = Partial<Record<"fbclid" | "gclid" | "gbraid" | "wbraid" | "ttclid" | "li_fat_id" | "msclkid", { v: string; ts: number }>>;

/**
 * What the tracker sends for an identified visitor: click ids and the ad platforms' own browser
 * ids — Meta's `_fbp`/`_fbc`, Google's `_ga`, TikTok's `_ttp` and LinkedIn's `li_fat_id` cookie.
 */
export type AdContext = { clk?: ClickIds; fbp?: string; fbc?: string; ga?: string; ttp?: string; li?: string };

/** One consented custom event from the tracker, as the `conversions` lane carries it. */
export type ConversionTrackerRow = {
  websiteId: string;
  /** Stable across retries of the batch: `batchId:index`, for events without an id of their own. */
  fallbackId: string;
  name: string;
  occurredAt: number;
  url: string;
  visitorId: string | null;
  properties: Record<string, unknown>;
  ip: string;
  userAgent: string;
  ad: AdContext | null;
};

/** A consented lead, from the leads module. */
export type ConversionLeadInput = {
  websiteId: string;
  submissionId: string;
  email: string;
  phone: string;
  pageUrl: string;
  visitorId: string | null;
  ip: string;
  userAgent: string;
  ad: AdContext | null;
  occurredAt: number;
};

/** Which event each kind is sent as; null turns that kind off. Custom events are opted in by name. */
export type DestinationConfig = {
  events: { purchase: string | null; lead: string | null; sign_up: string | null };
  custom: { name: string; platform_event: string }[];
  test_event_code?: string | null;
};

/**
 * What the platform request is built from, as the outbox stores it: only match keys and the
 * event's own facts. Email and phone are hashed before they are stored.
 */
export type ConversionPayload = {
  event_id: string;
  platform_event: string;
  occurred_at: number;
  url: string;
  value: number | null;
  currency: string | null;
  order_id: string | null;
  email_sha256: string | null;
  phone_sha256: string | null;
  external_id_sha256: string | null;
  client_id: string | null;
  ip: string | null;
  user_agent: string | null;
  fbc: string | null;
  fbp: string | null;
  /** TikTok's click id and `_ttp` browser id. Absent on rows queued before TikTok was added. */
  ttclid?: string | null;
  ttp?: string | null;
  /** LinkedIn's first-party click id, from the ad link or the Insight Tag's cookie. */
  li_fat_id?: string | null;
};

export type ConversionDestinationView = {
  id: string;
  platform: ConversionPlatform;
  name: string;
  enabled: boolean;
  status: "active" | "error";
  last_error: string | null;
  credentials_hint: string;
  config: DestinationConfig;
  created_at: string;
  updated_at: string;
  stats: { sent_7d: number; failed_7d: number; last_sent_at: string | null };
};

export type ConversionEventView = {
  id: string;
  destination_id: string;
  platform: ConversionPlatform;
  kind: ConversionKind;
  event_name: string;
  platform_event: string;
  status: "pending" | "success" | "failed" | "skipped";
  error: string | null;
  attempt_count: number;
  match_keys: MatchKey[];
  value: number | null;
  currency: string | null;
  order_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ConversionSummary = {
  totals: { sent: number; accepted: number; failed: number; skipped: number; pending: number };
  by_day: { day: string; accepted: number; failed: number }[];
  match: { total: number } & Record<MatchKey, number>;
  by_kind: { kind: ConversionKind; accepted: number }[];
};

/** Where ingest hands consented tracker events; the `conversions` lane calls this. */
export interface ConversionIngest {
  processEvents(batchId: string, rows: readonly ConversionTrackerRow[]): Promise<number>;
}

/** The dashboard's reads and changes. */
export interface ConversionAdmin {
  list(websiteId: string): Promise<ConversionDestinationView[]>;
  create(websiteId: string, input: { platform: ConversionPlatform; name?: string; credentials: Record<string, string>; config?: Partial<DestinationConfig> }):
    Promise<{ destination: ConversionDestinationView } | { error: "invalid_credentials"; message: string } | { error: "exists" }>;
  update(websiteId: string, id: string, patch: { name?: string; enabled?: boolean; credentials?: Record<string, string>; config?: Partial<DestinationConfig> }):
    Promise<{ destination: ConversionDestinationView } | { error: "invalid_credentials"; message: string } | { error: "not_found" }>;
  remove(websiteId: string, id: string): Promise<boolean>;
  test(websiteId: string, id: string, testEventCode: string | null): Promise<{ ok: boolean; message: string } | null>;
  events(websiteId: string, q: { destination: string | null; status: string | null; kind: string | null; limit: number; offset: number }):
    Promise<{ events: ConversionEventView[]; total: number }>;
  retry(websiteId: string, id: string): Promise<boolean>;
  summary(websiteId: string, days: number): Promise<ConversionSummary>;
  /** Destinations on the account's websites, for the plan limit. */
  countForWebsites(websiteIds: readonly string[]): Promise<number>;
}
