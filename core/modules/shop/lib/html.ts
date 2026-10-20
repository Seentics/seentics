/** Every seller-written value reaches the page through these. Nothing is ever inserted raw. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Text with its line breaks kept as <br>, escaped first. */
export const escapeMultiline = (value: string): string => escapeHtml(value).replace(/\r?\n/g, "<br>");

/**
 * A value for inside an inline <script>, as JSON: `</script>` and `<!--` cannot close or
 * comment out the block, and U+2028/2029 cannot end a string literal in older engines.
 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** An image or link URL a seller gave: only https (or our own relative image paths) is used. */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/i/")) return value;
  try {
    const u = new URL(value);
    return allowedUrl(u) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * https, or plain http on a development host (`localhost`, `*.localhost`, 127.0.0.1): there the shop's
 * own uploads are http://shop.localhost:8000/i/..., and refusing them left every local page without
 * photos. The page validators and the renderer share this one rule.
 */
export function allowedUrl(u: URL): boolean {
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname.endsWith(".localhost") || u.hostname === "127.0.0.1");
}
