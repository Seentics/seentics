import { Hono } from "hono";
import type { Env } from "hono";
import { authMiddleware, type AuthVars } from "../../platform/middleware/auth";
import type { AuthedRouter, PublicRouter } from "../../platform/http/router";
import { parseJson, validationErrorResponse } from "../../platform/validation";
import type { AuthService } from "./services/auth.service";
import { toFrontendUser } from "./services/user-mapper";
import {
  authLoginSchema,
  authRefreshSchema,
  authRegisterSchema,
  passthroughObjectSchema,
} from "./validators/auth.schema";

/**
 * The auth surface, mounted twice.
 *
 * `/api/v1/auth` and `/api/v1/user/auth` expose the same register/login/refresh trio —
 * the second is what the web client calls, the first is the older path that deployed
 * snippets still use. They were two hand-written copies of the same three handlers, so
 * a change to one (a status code, an error shape) silently applied to only half the
 * surface. `registerCredentialRoutes` now defines them once and mounts them on both.
 *
 * A factory rather than module-level routers, because the handlers need an
 * `AuthService` and that service now holds injected storage.
 */

/** Errors are deliberately uniform — see `AuthService.register`. */
function registerCredentialRoutes<E extends Env>(r: Hono<E>, auth: AuthService) {
  r.post("/register", async (c) => {
    const parsed = await parseJson(c, authRegisterSchema);
    if (!parsed.ok) return parsed.res;
    const { email, password, name } = parsed.data;
    try {
      return c.json(await auth.register({ email, password, name: name ?? "" }), 201);
    } catch {
      return c.json({ error: "Registration failed" }, 400);
    }
  });

  r.post("/login", async (c) => {
    const parsed = await parseJson(c, authLoginSchema);
    if (!parsed.ok) return parsed.res;
    const { email, password } = parsed.data;
    try {
      return c.json(await auth.login({ email, password }));
    } catch {
      return c.json({ error: "invalid credentials" }, 401);
    }
  });

  r.post("/refresh", async (c) => {
    const parsed = await parseJson(c, authRefreshSchema);
    if (!parsed.ok) return parsed.res;
    try {
      return c.json(await auth.refresh(parsed.data.refresh_token.trim()));
    } catch {
      return c.json({ error: "invalid refresh token" }, 401);
    }
  });
}

/** `/api/v1/auth` — no auth context; this is the router that establishes one. */
export function createAuthRoutes(auth: AuthService): PublicRouter {
  const r = new Hono();
  registerCredentialRoutes(r, auth);

  // Declared so the client gets a 501 rather than a 404 while these are unbuilt.
  r.post("/forgot-password", (c) => c.json({ error: "Not implemented" }, 501));
  r.post("/reset-password", (c) => c.json({ error: "Not implemented" }, 501));

  return r;
}

/** `/api/v1/user/auth` — the session-scoped variants. */
export function createUserAuthRoutes(auth: AuthService): AuthedRouter {
  const r = new Hono<{ Variables: AuthVars }>();
  registerCredentialRoutes(r, auth);

  r.get("/setup-status", async (c) =>
    c.json({ data: { setupComplete: (await auth.countUsers()) > 0 } }),
  );

  r.get("/google", (c) => c.json({ error: "OAuth not configured; use email/password" }, 501));
  r.get("/github", (c) => c.json({ error: "OAuth not configured; use email/password" }, 501));
  r.get("/google/callback", (c) => c.json({ error: "OAuth not configured" }, 501));

  r.get("/me", authMiddleware, async (c) => {
    const row = await auth.getById(c.get("userId"));
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ data: { user: toFrontendUser(row) } });
  });

  r.post("/verify-secrets", async (c) => {
    // Validate the JSON shape even though the endpoint is stubbed, so a client that
    // starts sending a body learns about a malformed one now rather than later.
    const body = await c.req.json().catch(() => null);
    const ok = passthroughObjectSchema.safeParse(body);
    if (!ok.success) return validationErrorResponse(c, ok.error);
    return c.json({ data: { verified: false } });
  });

  return r;
}
