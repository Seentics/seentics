import { createHash } from "node:crypto";
import type {
  AdContext,
  ClickIds,
  ConversionKind,
  ConversionPlatform,
  DestinationConfig,
  MatchKey,
} from "../interfaces/conversions";

/**
 * The pure rules of server-side conversions: what kind an event is, what it is worth, how a
 * person is matched, and which event a destination sends it as.
 */

/** Event names that count as a purchase — the revenue dashboard's list, plus checkout_completed. */
const PURCHASE = new Set(["purchase", "order_completed", "ecommerce_purchase", "transaction", "checkout_completed"]);
const SIGN_UP = new Set(["sign_up", "signup", "sign-up", "registration", "register", "complete_registration", "user_signup"]);
const LEAD = new Set(["lead", "generate_lead"]);
/** Pushed by the popup after a submit: the lead itself arrives through the leads module, with its email. */
const INTERNAL = new Set(["lead_captured"]);

/** A tracker event's kind, or null for one that is never forwarded. */
export function kindOf(name: string): ConversionKind | null {
  const n = name.trim().toLowerCase();
  if (!n || INTERNAL.has(n)) return null;
  if (PURCHASE.has(n)) return "purchase";
  if (SIGN_UP.has(n)) return "sign_up";
  if (LEAD.has(n)) return "lead";
  return "custom";
}

export const DEFAULT_EVENTS: Record<ConversionPlatform, DestinationConfig["events"]> = {
  meta: { purchase: "Purchase", lead: "Lead", sign_up: "CompleteRegistration" },
  ga4: { purchase: "purchase", lead: "generate_lead", sign_up: "sign_up" },
  tiktok: { purchase: "CompletePayment", lead: "SubmitForm", sign_up: "CompleteRegistration" },
  // LinkedIn sends each event to a conversion rule the owner made in Campaign Manager, by its
  // id: there is no standard name to default to, so nothing is sent until one is entered.
  linkedin: { purchase: null, lead: null, sign_up: null },
};

export function withDefaults(platform: ConversionPlatform, config: Partial<DestinationConfig> | undefined): DestinationConfig {
  const events = { ...DEFAULT_EVENTS[platform], ...(config?.events ?? {}) };
  const custom = (config?.custom ?? [])
    .map((m) => ({ name: m.name.trim().slice(0, 120), platform_event: m.platform_event.trim().slice(0, 120) }))
    .filter((m) => m.name && m.platform_event)
    .slice(0, 50);
  return { events, custom, test_event_code: config?.test_event_code?.trim() || null };
}

/** The event a destination sends this as, or null when it does not send it. */
export function platformEventFor(config: DestinationConfig, kind: ConversionKind, name: string): string | null {
  if (kind !== "custom") return config.events[kind];
  const n = name.trim().toLowerCase();
  return config.custom.find((m) => m.name.toLowerCase() === n)?.platform_event ?? null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : null;
};

/** The value, as the revenue dashboard reads it: value, then revenue, amount, total. */
export function valueOf(props: Record<string, unknown>): number | null {
  for (const k of ["value", "revenue", "amount", "total"]) {
    const v = num(props[k]);
    if (v !== null) return v;
  }
  return null;
}

export function currencyOf(props: Record<string, unknown>, hasValue: boolean): string | null {
  const c = typeof props.currency === "string" ? props.currency.trim().toUpperCase() : "";
  if (/^[A-Z]{3}$/.test(c)) return c;
  // The platforms want a currency with every value; the owner's own, unstated, is most often USD.
  return hasValue ? "USD" : null;
}

export function orderIdOf(props: Record<string, unknown>): string | null {
  for (const k of ["order_id", "transaction_id", "orderId", "id"]) {
    const v = props[k];
    if ((typeof v === "string" && v.trim()) || typeof v === "number") return String(v).trim().slice(0, 200);
  }
  return null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Meta's and Google's normalisation: trimmed, lower-cased, then SHA-256. */
export function hashEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? sha256(e) : null;
}

/** Digits only, country code included (no +, no leading zeros), then SHA-256. Too short to be a number is none. */
export function hashPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 7 && digits.length <= 15 ? sha256(digits) : null;
}

export function hashId(raw: string | null): string | null {
  return raw ? sha256(raw) : null;
}

/**
 * Meta's click id cookie: the pixel's own `_fbc` when the site runs it, else built from the
 * fbclid the ad link carried — `fb.1.<ms when clicked>.<fbclid>`.
 */
export function fbcOf(ad: AdContext | null): string | null {
  if (ad?.fbc && /^fb\.\d\.\d+\./.test(ad.fbc)) return ad.fbc.slice(0, 300);
  const click = ad?.clk?.fbclid;
  return click ? `fb.1.${click.ts}.${click.v}`.slice(0, 300) : null;
}

export function fbpOf(ad: AdContext | null): string | null {
  return ad?.fbp && /^fb\.\d\.\d+\.\d+/.test(ad.fbp) ? ad.fbp.slice(0, 200) : null;
}

/** GA4's client id from the `_ga` cookie (`GA1.1.123.456` → `123.456`), so the event joins gtag's visitor. */
export function gaClientIdOf(ad: AdContext | null): string | null {
  const m = ad?.ga?.match(/^GA\d\.\d+\.(\d+\.\d+)$/);
  return m ? m[1]! : null;
}

/** TikTok's click id, from the ad link (`ttclid`). */
export function ttclidOf(ad: AdContext | null): string | null {
  return ad?.clk?.ttclid?.v.slice(0, 500) ?? null;
}

/** TikTok's browser id, the `_ttp` cookie its pixel sets. */
export function ttpOf(ad: AdContext | null): string | null {
  return ad?.ttp && /^[\w.-]{8,200}$/.test(ad.ttp) ? ad.ttp : null;
}

/** LinkedIn's first-party click id: the ad link's `li_fat_id`, else the Insight Tag's cookie of that name. */
export function liFatIdOf(ad: AdContext | null): string | null {
  const v = ad?.clk?.li_fat_id?.v ?? ad?.li ?? null;
  return v && /^[\w-]{8,200}$/.test(v) ? v : null;
}

/** Which keys a platform will match this person by — shown in the delivery log as "matched with". */
export function matchKeysFor(
  platform: ConversionPlatform,
  p: {
    email: string | null; phone: string | null; ip: string | null; ua: string | null; fbc: string | null; fbp: string | null;
    gaClientId: string | null; clk: ClickIds | undefined; ttclid?: string | null; ttp?: string | null; liFatId?: string | null;
  },
): MatchKey[] {
  const click = { meta: !!p.fbc, ga4: !!(p.clk?.gclid || p.clk?.gbraid || p.clk?.wbraid), tiktok: !!p.ttclid, linkedin: !!p.liFatId }[platform];
  const browser = { meta: !!p.fbp, ga4: !!p.gaClientId, tiktok: !!p.ttp, linkedin: false }[platform];
  const keys: MatchKey[] = [];
  if (click) keys.push("click_id");
  if (p.email) keys.push("email");
  // LinkedIn matches by email and its click id only; it takes no phone, IP or browser.
  if (p.phone && platform !== "linkedin") keys.push("phone");
  if ((platform === "meta" || platform === "tiktok") && p.ip && p.ua) keys.push("ip_ua");
  if (browser) keys.push("browser_id");
  return keys;
}

/** A pasted value, without stray whitespace; long enough to be a secret, short enough to be one. */
export function cleanSecret(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
