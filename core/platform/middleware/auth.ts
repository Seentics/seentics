import type { Context, Next } from "hono";
import { env } from "../../config";
import { verifyAccessToken } from "../lib/auth-jwt";

export type AuthVars = {
  userId: string;
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
    const { userId } = await verifyAccessToken(token);
    c.set("userId", userId);
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

/** Optional JWT: sets userId when valid Bearer present; never401. */
export async function optionalAuthMiddleware(c: Context<{ Variables: AuthVars }>, next: Next) {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ") && env().jwtSecret) {
    const token = auth.slice(7).trim();
    try {
      const { userId } = await verifyAccessToken(token);
      c.set("userId", userId);
    } catch {
      /* ignore */
    }
  }
  return next();
}
