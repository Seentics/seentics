import { Hono } from "hono";
import type { AuthLoginJson, AuthRefreshJson, AuthRegisterJson } from "../../platform/lib/api-types";
import type { JsonRequestContext } from "./lib/hono-types";
import { authMiddleware, type AuthVars } from "../../platform/middleware/auth";
import * as authSvc from "./services/auth.service";
import { toFrontendUser } from "../../platform/lib/user-mapper";
import { parseJson, validationErrorResponse } from "../../platform/validation";
import {
  authLoginSchema,
  authRefreshSchema,
  authRegisterSchema,
  passthroughObjectSchema,
} from "./validators/auth.schema";

const r = new Hono();

async function bodyJson(c: JsonRequestContext) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

r.post("/register", async (c) => {
  const parsed = await parseJson(c, authRegisterSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data as unknown as AuthRegisterJson;
  try {
    const out = await authSvc.registerUser({
      email: String((parsed.data as { email: string }).email),
      password: String((parsed.data as { password: string }).password),
      name: String((parsed.data as { name: string }).name ?? ""),
    });
    return c.json(out, 201);
  } catch {
    return c.json({ error: "Registration failed" }, 400);
  }
});

r.post("/login", async (c) => {
  const parsed = await parseJson(c, authLoginSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data as unknown as AuthLoginJson;
  try {
    const out = await authSvc.loginUser({
      email: String((parsed.data as { email: string }).email),
      password: String((parsed.data as { password: string }).password),
    });
    return c.json(out);
  } catch {
    return c.json({ error: "invalid credentials" }, 401);
  }
});

r.post("/refresh", async (c) => {
  const parsed = await parseJson(c, authRefreshSchema);
  if (!parsed.ok) return parsed.res;
  const refresh = String((parsed.data as { refresh_token: string }).refresh_token).trim();
  try {
    const tokens = await authSvc.refreshSession(refresh);
    return c.json(tokens);
  } catch {
    return c.json({ error: "invalid refresh token" }, 401);
  }
});

r.post("/forgot-password", async (c) => {
  void c.req.json().catch(() => null);
  return c.json({ error: "Not implemented" }, 501);
});

r.post("/reset-password", async (c) => {
  void c.req.json().catch(() => null);
  return c.json({ error: "Not implemented" }, 501);
});

const userAuth = new Hono<{ Variables: AuthVars }>();

userAuth.get("/setup-status", async (c) => {
  const n = await authSvc.countUsers();
  return c.json({ data: { setupComplete: n > 0 } });
});

userAuth.post("/register", async (c) => {
  const parsed = await parseJson(c, authRegisterSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data as unknown as AuthRegisterJson;
  try {
    const out = await authSvc.registerUser({
      email: String((parsed.data as { email: string }).email),
      password: String((parsed.data as { password: string }).password),
      name: String((parsed.data as { name: string }).name ?? ""),
    });
    return c.json(out, 201);
  } catch {
    return c.json({ error: "Registration failed" }, 400);
  }
});

userAuth.post("/login", async (c) => {
  const parsed = await parseJson(c, authLoginSchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data as unknown as AuthLoginJson;
  try {
    const out = await authSvc.loginUser({
      email: String((parsed.data as { email: string }).email),
      password: String((parsed.data as { password: string }).password),
    });
    return c.json(out);
  } catch {
    return c.json({ error: "invalid credentials" }, 401);
  }
});

userAuth.post("/refresh", async (c) => {
  const parsed = await parseJson(c, authRefreshSchema);
  if (!parsed.ok) return parsed.res;
  const refresh = String((parsed.data as { refresh_token: string }).refresh_token).trim();
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
  // Validate JSON shape even though this endpoint is currently stubbed.
  const body = await c.req.json().catch(() => null);
  const ok = passthroughObjectSchema.safeParse(body);
  if (!ok.success) return validationErrorResponse(c, ok.error);
  return c.json({ data: { verified: false } });
});

export const authRoutes = r;
export const userAuthRoutes = userAuth;
