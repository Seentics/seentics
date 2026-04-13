import { Hono } from "hono";
import type { AuthLoginJson, AuthRefreshJson, AuthRegisterJson } from "../lib/api-types";
import type { JsonRequestContext } from "../lib/hono-types";
import { authMiddleware, type AuthVars } from "../middleware/auth";
import * as authSvc from "../services/auth.service";
import { toFrontendUser } from "../lib/user-mapper";

const r = new Hono();

async function bodyJson(c: JsonRequestContext) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

r.post("/register", async (c) => {
  const b = (await bodyJson(c)) as AuthRegisterJson | null;
  if (!b?.email || !b?.password) return c.json({ error: "email and password required" }, 400);
  try {
    const out = await authSvc.registerUser({
      email: b.email,
      password: b.password,
      name: b.name ?? "",
    });
    return c.json(out, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "register failed";
    return c.json({ error: msg }, 400);
  }
});

r.post("/login", async (c) => {
  const b = (await bodyJson(c)) as AuthLoginJson | null;
  if (!b?.email || !b?.password) return c.json({ error: "email and password required" }, 400);
  try {
    const out = await authSvc.loginUser({ email: b.email, password: b.password });
    return c.json(out);
  } catch {
    return c.json({ error: "invalid credentials" }, 401);
  }
});

r.post("/refresh", async (c) => {
  const b = (await bodyJson(c)) as AuthRefreshJson | null;
  const refresh = b?.refresh_token?.trim();
  if (!refresh) return c.json({ error: "refresh_token required" }, 400);
  try {
    const tokens = await authSvc.refreshSession(refresh);
    return c.json(tokens);
  } catch {
    return c.json({ error: "invalid refresh token" }, 401);
  }
});

r.post("/forgot-password", async (c) => {
  void c.req.json().catch(() => null);
  return c.json({ data: { ok: true } });
});

r.post("/reset-password", async (c) => {
  void c.req.json().catch(() => null);
  return c.json({ data: { ok: true } });
});

const userAuth = new Hono<{ Variables: AuthVars }>();

userAuth.get("/setup-status", async (c) => {
  const n = await authSvc.countUsers();
  return c.json({ data: { setupComplete: n > 0 } });
});

userAuth.post("/register", async (c) => {
  const b = (await bodyJson(c)) as AuthRegisterJson | null;
  if (!b?.email || !b?.password) return c.json({ error: "email and password required" }, 400);
  try {
    const out = await authSvc.registerUser({
      email: b.email,
      password: b.password,
      name: b.name ?? "",
    });
    return c.json(out, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "register failed";
    return c.json({ error: msg }, 400);
  }
});

userAuth.post("/login", async (c) => {
  const b = (await bodyJson(c)) as AuthLoginJson | null;
  if (!b?.email || !b?.password) return c.json({ error: "email and password required" }, 400);
  try {
    const out = await authSvc.loginUser({ email: b.email, password: b.password });
    return c.json(out);
  } catch {
    return c.json({ error: "invalid credentials" }, 401);
  }
});

userAuth.post("/refresh", async (c) => {
  const b = (await bodyJson(c)) as AuthRefreshJson | null;
  const refresh = b?.refresh_token?.trim();
  if (!refresh) return c.json({ error: "refresh_token required" }, 400);
  try {
    const tokens = await authSvc.refreshSession(refresh);
    return c.json(tokens);
  } catch {
    return c.json({ error: "invalid refresh token" }, 401);
  }
});

userAuth.get("/google", (c) => c.json({ error: "OAuth not configured; use email/password" }, 501));
userAuth.get("/github", (c) => c.json({ error: "OAuth not configured; use email/password" }, 501));
userAuth.get("/google/callback", (c) => c.json({ error: "OAuth not configured" }, 501));

userAuth.get("/me", authMiddleware, async (c) => {
  const uid = c.get("userId");
  const row = await authSvc.getUserById(uid);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ data: { user: toFrontendUser(row) } });
});

userAuth.post("/verify-secrets", async (c) => {
  void c.req.json().catch(() => null);
  return c.json({ data: { verified: false } });
});

export const authRoutes = r;
export const userAuthRoutes = userAuth;
