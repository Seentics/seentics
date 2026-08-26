import { timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../../config";

/** Constant-time compare for `X-API-Key` against `GLOBAL_API_KEY`. */
export function isGlobalApiKeyValid(cfg: AppConfig, headerValue: string | undefined): boolean {
  const expected = cfg.globalApiKey;
  const got = headerValue ?? "";
  if (!expected || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}
