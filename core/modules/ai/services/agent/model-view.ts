/**
 * What of a tool's result may leave for the model provider.
 *
 * AI Mode answers from aggregates: counts, rates, pages, sources. The provider is a
 * third party (a subprocessor), and nothing that identifies or singles out a visitor
 * needs to reach it for any of those answers. This is the one exit — every tool result
 * passes through here on its way into the conversation — so a tool added later, or a
 * repository that grows a column, cannot quietly widen what is sent.
 *
 * The dashboard still gets the full rows: the display block (links to a recording, say)
 * is built before this and never goes to the model.
 */

/** Fields that identify a visitor, a session, or a device — dropped wherever they appear. */
const IDENTIFYING_KEYS = new Set([
  "visitor_id", "visitorid", "session_id", "sessionid", "user_id", "userid",
  "external_id", "anonymous_id", "distinct_id", "fingerprint",
  "ip", "ip_address", "ipaddress", "client_ip",
  "user_agent", "useragent", "ua",
  // Not `name`: funnels, automations and pages have names the answers depend on.
  "email", "phone", "first_name", "last_name", "full_name",
  // Free-form bags a site can put anything into, personal data included.
  "properties", "event_properties", "user_properties", "traits", "metadata",
]);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** A query string or fragment on a URL or path — where tokens, emails and ids ride along. */
const URL_TAIL = /((?:https?:\/\/|\/)[^\s?#"']*)[?#][^\s"']*/gi;

function scrubText(value: string): string {
  return value.replace(EMAIL, "[email]").replace(URL_TAIL, "$1");
}

/**
 * Marks a value kept from the model. An edit that sends it back keeps the stored value
 * (`restoreTruncated` in tools/propose-automation-edit.tool.ts).
 */
export const HIDDEN = "[hidden]";

/** Keys whose values are credentials: sent as HIDDEN. */
const SECRET_KEYS = new Set(["secret", "token", "api_key", "apikey", "password", "signing_secret", "webhook_secret"]);

/**
 * A webhook's address past its host. Slack, Zapier and Discord hooks carry their
 * credential in the path, and a custom header is usually a key: both reached the provider
 * whenever the assistant listed or opened an automation.
 */
function hideWebhookSecrets(action: Record<string, unknown>): Record<string, unknown> {
  const out = { ...action };
  if (typeof out.url === "string") {
    try {
      const u = new URL(out.url);
      out.url = `${u.protocol}//${u.host}/${HIDDEN}`;
    } catch {
      out.url = HIDDEN;
    }
  }
  if (out.headers && typeof out.headers === "object" && !Array.isArray(out.headers)) {
    out.headers = Object.fromEntries(Object.keys(out.headers).map((k) => [k, HIDDEN]));
  }
  return out;
}

export function forModel(value: unknown): unknown {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(forModel);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const source = (value as Record<string, unknown>).type === "webhook"
      ? hideWebhookSecrets(value as Record<string, unknown>)
      : (value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(source)) {
      if (IDENTIFYING_KEYS.has(key.toLowerCase())) continue;
      out[key] = SECRET_KEYS.has(key.toLowerCase()) && typeof v === "string" ? HIDDEN : forModel(v);
    }
    return out;
  }
  return value;
}
