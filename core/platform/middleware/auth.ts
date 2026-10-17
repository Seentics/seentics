import type { Context, Next } from "hono";
import { env } from "../../config";
import { verifyAccessToken } from "../security/auth-jwt";

export type AuthVars = {
  userId: string;
  /**
   * Set when the caller is an agency's client user: the agency owner's id. From the token's
   * `agency` claim, else from `X-Client-Agency`, which the gateway sets on a client user's
   * requests. Its only use is narrowing — it never grants anything a membership does not.
   */
  clientAgency?: string;
};

/** JWT (Bearer or access_token cookie). */
export async function authMiddleware(c: Context<{ Variables: AuthVars }>, next: Next) {
  const cfg = env();
  if (!cfg.jwtSecret) {
    return c.json({ error: "JWT_SECRET not configured" }, 500);
  }

  let token = "";
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) token = auth.slice(7).trim();
  else {
    const cookie = c.req.raw.headers.get("cookie");
    const m = cookie?.match(/access_token=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]!);
  }

  if (!token) return c.json({ error: "Authorization required" }, 401);

  try {
    const { userId, clientAgency } = await verifyAccessToken(token);
    c.set("userId", userId);
    const agency = clientAgency ?? c.req.header("X-Client-Agency")?.trim();
    if (agency) c.set("clientAgency", agency);
    return next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export function requireUser(c: Context<{ Variables: AuthVars }>): string | null {
  const id = c.get("userId");
  if (!id) return null;
  return id;
}
