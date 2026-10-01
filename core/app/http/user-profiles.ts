import { Hono } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import type { PasswordChanger, UserDirectory } from "../../modules/auth/interfaces";

/**
 * A factory now, so the user lookup arrives as a port. This file used to import
 * `getUserById` out of the former all-purpose auth service — the module that also held password
 * hashing and token signing.
 */
export function createUserProfileRoutes(deps: { users: UserDirectory; passwords: PasswordChanger }) {
const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.put("/profile", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  void c.req.json().catch(() => null);
  const user = await deps.users.getProfileForClient(uid);
  if (!user) return c.json({ error: "not found" }, 404);
  return c.json({ data: { user } });
});

// This answered { ok: true } without calling anything: the dashboard said "Password
// changed" while nothing changed, and the current password was never checked.
r.put("/change-password", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => null)) as { current_password?: unknown; new_password?: unknown } | null;
  const current = typeof body?.current_password === "string" ? body.current_password : "";
  const next = typeof body?.new_password === "string" ? body.new_password : "";
  if (!current || !next) return c.json({ error: "current_password and new_password are required" }, 400);
  switch (await deps.passwords.changePassword(uid, current, next)) {
    case "changed": return c.json({ data: { ok: true } });
    case "bad-current": return c.json({ error: "Current password is incorrect" }, 400);
    case "invalid-new": return c.json({ error: "A password (8-256 characters) is required" }, 400);
    default: return c.json({ error: "unauthorized" }, 401);
  }
});

r.put("/avatar", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

r.get("/preferences", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: {} });
});

r.put("/preferences", async (c) => {
  if (!requireUser(c)) return c.json({ error: "unauthorized" }, 401);
  return c.json({ data: { ok: true } });
});

return r;
}
