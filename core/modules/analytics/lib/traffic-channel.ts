/**
 * Traffic channel of a pageview: paid, email, social, organic, campaign, internal,
 * referral, direct.
 *
 * Classified once, at ingest, and stored on the event. It used to be derived on every
 * read by a SQL CASE with two case-insensitive regexes over each pageview's referrer —
 * at 845k pageviews that was ~3.9 s of a 13 s traffic-summary query, spent re-deriving a
 * fact that never changes after the event is written.
 *
 * `internal` is a pageview reached from another page of the same site: the browser sends
 * the previous page as the referrer on every in-site click. It is not a way traffic
 * arrives, so it must never be reported as one — before it existed, most of a
 * multi-page site's "referral" traffic was its own navigation, and revenue credited the
 * site itself as its top source. Session-level reads attribute a session to its first
 * non-internal pageview instead.
 *
 * The same rules exist in three places, deliberately: `classifyTrafficChannel` for new
 * events, `CHANNEL_CASE_SQL` for reads of any row still missing a stored channel, and a
 * frozen copy in `db/sql/029_analytics_events_channel.sql` that backfilled existing rows
 * (migrations are static SQL and cannot import this). The first two are built from the
 * patterns below so they cannot disagree, and the SQL semantics are kept exactly —
 * including which comparisons are case-sensitive — so a row classifies the same
 * whichever path wrote it. Change the rules here and the tests pin both.
 */

// Host-anchored: escape dots and require the domain at the end of the referrer host
// (optionally behind subdomains), so 'x.com' never matches 'wix.com' and 'google.'
// never matches a path segment.
export const SOCIAL_HOST_PATTERN =
  "^https?://([^/]*\\.)?(facebook\\.com|twitter\\.com|x\\.com|instagram\\.com|linkedin\\.com|pinterest\\.com|reddit\\.com|t\\.co|youtube\\.com|tiktok\\.com|snapchat\\.com)([/:?#]|$)";

export const SEARCH_HOST_PATTERN =
  "^https?://([^/]*\\.)?(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\\.";

/** The host of an http(s) URL, as the SQL `substring(... from ...)` extracts it. */
const HOST_PATTERN = "^https?://([^/?#:]+)";

const PAID_MEDIUMS = ["cpc", "ppc", "paid", "paid_social", "paidsearch", "paid_search", "sem"];
const SOCIAL_SOURCES = ["facebook", "twitter", "x", "instagram", "linkedin", "pinterest", "tiktok", "youtube", "reddit"];

export type TrafficChannel =
  | "paid" | "email" | "social" | "organic" | "campaign" | "internal" | "referral" | "direct";

const socialHost = new RegExp(SOCIAL_HOST_PATTERN, "i");
const searchHost = new RegExp(SEARCH_HOST_PATTERN, "i");
const hostOf = new RegExp(HOST_PATTERN, "i");

/** Postgres `trim()` strips spaces only, not all whitespace — match it. */
function hasText(value: string | null | undefined): value is string {
  return value != null && value.replace(/^ +| +$/g, "").length > 0;
}

/** Host without a leading `www.`, lowercased; null for anything that is not http(s). */
function siteHost(url: string | null | undefined): string | null {
  const m = url == null ? null : hostOf.exec(url);
  return m ? m[1]!.toLowerCase().replace(/^www\./, "") : null;
}

export function classifyTrafficChannel(input: {
  referrer: string | null | undefined;
  page: string | null | undefined;
  utmSource: string | null | undefined;
  utmMedium: string | null | undefined;
}): TrafficChannel {
  const { referrer, page, utmSource, utmMedium } = input;
  const medium = (utmMedium ?? "").toLowerCase();
  if (PAID_MEDIUMS.includes(medium) || medium.startsWith("paid")) return "paid";
  if (utmMedium === "email" || utmSource === "email") return "email";
  if (utmMedium === "social" || (utmSource != null && SOCIAL_SOURCES.includes(utmSource))) return "social";
  if (referrer != null && socialHost.test(referrer)) return "social";
  if (referrer != null && searchHost.test(referrer)) return "organic";
  if (hasText(utmSource)) return "campaign";
  const refHost = siteHost(referrer);
  if (refHost !== null && refHost === siteHost(page)) return "internal";
  if (hasText(referrer)) return "referral";
  return "direct";
}

const sqlList = (values: string[]) => values.map((v) => `'${v}'`).join(", ");
const sqlPattern = (pattern: string) => `'${pattern.replace(/'/g, "''")}'`;
const sqlHost = (col: string) =>
  `lower(regexp_replace(substring(${col} from ${sqlPattern(HOST_PATTERN)}), '^www\\.', '', 'i'))`;

/**
 * The same classification as a SQL expression over `analytics_events` columns, optionally
 * qualified by a table alias — needed wherever another joined relation has a column of
 * the same name (revenue joins purchases, which carry their own `utm_medium`). Static
 * text built from the constants above — no caller input reaches it.
 */
export function channelCaseSql(alias?: string): string {
  const c = (col: string) => (alias ? `${alias}.${col}` : col);
  return `CASE
  WHEN lower(coalesce(${c("utm_medium")}, '')) IN (${sqlList(PAID_MEDIUMS)})
    OR lower(coalesce(${c("utm_medium")}, '')) LIKE 'paid%' THEN 'paid'
  WHEN ${c("utm_medium")} = 'email' OR ${c("utm_source")} = 'email' THEN 'email'
  WHEN ${c("utm_medium")} = 'social'
    OR ${c("utm_source")} IN (${sqlList(SOCIAL_SOURCES)})
    OR (${c("referrer")} IS NOT NULL AND ${c("referrer")} ~* ${sqlPattern(SOCIAL_HOST_PATTERN)}) THEN 'social'
  WHEN ${c("referrer")} IS NOT NULL AND ${c("referrer")} ~* ${sqlPattern(SEARCH_HOST_PATTERN)} THEN 'organic'
  WHEN ${c("utm_source")} IS NOT NULL AND length(trim(${c("utm_source")})) > 0 THEN 'campaign'
  WHEN ${sqlHost(c("referrer"))} = ${sqlHost(c("page"))} THEN 'internal'
  WHEN ${c("referrer")} IS NOT NULL AND length(trim(${c("referrer")})) > 0 THEN 'referral'
  ELSE 'direct'
END`;
}

/** `channelCaseSql()` over unqualified columns, for single-table queries. */
export const CHANNEL_CASE_SQL = channelCaseSql();

/* ── Referrers that are not a way anyone arrived ──────────────────────────────────────────
 *
 * `internal` above is a pageview whose referrer host is the page's own host. Two more kinds of
 * referrer are the same thing in practice — the visitor did not arrive from somewhere else, they
 * were sent away and came back — and counted as sources they made a site's own plumbing its top
 * "traffic":
 *
 *   - the site's other hosts: `observe.seentics.com`, `auth.seentics.com` and `seentics.com` are
 *     one product. A referrer on the same registrable domain is the site itself.
 *   - the providers a journey passes through and returns from: a checkout (Lemon Squeezy, Polar,
 *     Stripe, PayPal, Paddle) or a sign-in (Google, Apple, Microsoft, Auth0, Okta). A visitor who
 *     goes to pay and comes back is the same visit, not a new arrival from the payment page.
 *
 * Neither is stored differently: events keep the channel they were classified with, and a report
 * that credits a session to its source skips these at read time, so history needs no backfill.
 */
const EXCLUDED_REFERRER_DOMAINS = [
  "lemonsqueezy.com", "polar.sh", "stripe.com", "paypal.com", "paddle.com",
  "auth0.com", "okta.com", "appleid.apple.com", "login.microsoftonline.com", "login.live.com",
];
/** Exact hosts only: `accounts.google.com` is a sign-in, `google.com` is a search. */
const EXCLUDED_REFERRER_HOSTS = ["accounts.google.com"];

/** Second-level labels under which the registrable domain has one more label (`example.co.uk`). */
const SECOND_LEVEL = "com?|org|net|gov|edu|ac";
const REGISTRABLE_RE = new RegExp(`([^.]+\\.(?:(?:${SECOND_LEVEL})\\.[a-z]{2})|[^.]+\\.[^.]+)$`);

/** `blog.example.co.uk` → `example.co.uk`; an address or a bare host is returned as it is. */
export function registrableDomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.toLowerCase();
  if (!h.includes(".") || /^[0-9.]+$/.test(h)) return h;
  return REGISTRABLE_RE.exec(h)?.[1] ?? h;
}

/**
 * Whether a pageview's referrer should not be credited as how the visit arrived: the site's own
 * hosts, or a payment or sign-in provider. `refHost` and `pageHost` are bare hosts without `www.`.
 */
export function isSelfOrPassThroughReferrer(refHost: string | null | undefined, pageHost: string | null | undefined): boolean {
  if (!refHost) return false;
  const ref = refHost.toLowerCase();
  if (registrableDomain(ref) !== null && registrableDomain(ref) === registrableDomain(pageHost)) return true;
  if (EXCLUDED_REFERRER_HOSTS.includes(ref)) return true;
  return EXCLUDED_REFERRER_DOMAINS.some((d) => ref === d || ref.endsWith(`.${d}`));
}

/** `registrableDomain` as SQL over a host expression. */
export const registrableDomainSql = (host: string) => `(CASE
  WHEN ${host} IS NULL THEN NULL
  WHEN position('.' in ${host}) = 0 OR ${host} ~ '^[0-9.]+$' THEN ${host}
  ELSE coalesce(substring(${host} from ${sqlPattern(REGISTRABLE_RE.source)}), ${host})
END)`;

/**
 * `isSelfOrPassThroughReferrer` as a SQL boolean over two host expressions (the referrer's, as
 * `referrerDomainSql` gives it, and the page's). False — never NULL — when there is no referrer.
 * Static text built from the constants above; no caller input reaches it.
 */
export const selfOrPassThroughReferrerSql = (refHost: string, pageHost: string) => `coalesce(
  (${refHost} IS NOT NULL AND (
    ${registrableDomainSql(refHost)} = ${registrableDomainSql(pageHost)}
    OR ${refHost} IN (${sqlList(EXCLUDED_REFERRER_HOSTS)})
    OR ${refHost} ~ ${sqlPattern(`(^|\\.)(${EXCLUDED_REFERRER_DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|")})$`)}
  )), false)`;

/**
 * Whether a pageview counts toward how its session arrived: not in-site navigation, and not the
 * site's own hosts or a provider the visitor passed through. `ch`, `refHost` and `pageHost` are
 * SQL expressions.
 */
export const arrivalPageviewSql = (ch: string, refHost: string, pageHost: string) =>
  `(${ch} <> 'internal' AND NOT ${selfOrPassThroughReferrerSql(refHost, pageHost)})`;
