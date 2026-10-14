import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../config";

/**
 * Short capability tokens: "this holder may read `<scope>` of `<subject>` until `<exp>`".
 *
 * For assets the browser fetches by plain URL — a `<link rel=stylesheet>` inside a replay
 * or a sandboxed snapshot — where no Authorization header or cookie can go. The same idea
 * as a presigned object-store URL: an authenticated read hands the URL out, and the URL
 * is the permission. Format: `<exp seconds>.<base64url HMAC-SHA256(scope, subject, exp)>`.
 */

let fallbackSecret: string | null = null;

/**
 * The signing key: JWT_SECRET, else GLOBAL_API_KEY. Both are required (and long) in
 * production; a development process with neither signs with a random per-process key,
 * which is enough for one process that both issues and checks the tokens.
 */
export function scopedTokenSecret(): string {
  const cfg = env();
  const configured = cfg.jwtSecret || cfg.globalApiKey;
  if (configured) return configured;
  fallbackSecret ??= randomBytes(32).toString("hex");
  return fallbackSecret;
}

function mac(secret: string, scope: string, subject: string, exp: number): Buffer {
  return createHmac("sha256", secret).update(`${scope}\n${subject}\n${exp}`).digest();
}

export function signScopedToken(secret: string, scope: string, subject: string, expSeconds: number): string {
  return `${expSeconds}.${mac(secret, scope, subject, expSeconds).toString("base64url")}`;
}

/** True only for an unexpired token minted for exactly this scope and subject. */
export function verifyScopedToken(
  secret: string,
  scope: string,
  subject: string,
  token: string | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expText = token.slice(0, dot);
  if (!/^\d{1,12}$/.test(expText)) return false;
  const exp = Number(expText);
  if (exp < nowSeconds) return false;
  let given: Buffer;
  try {
    given = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return false;
  }
  const expected = mac(secret, scope, subject, exp);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
