import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseJson, validationErrorResponse } from "../../platform/validation";
import {
  goalCreateSchema,
  goalPatchSchema,
  memberAddSchema,
  memberRoleSchema,
  websiteCreateSchema,
  websitePatchSchema,
} from "./validators/website.schema";
// Team membership, goals and public sharing still live in `services/websites/*`.
// They are the remaining un-migrated slice of this domain and each resolves its own
// website reference, which is why they are called directly rather than injected.
// Migrating them is what lets `services/websites/` be deleted.
import * as goalsSvc from "./services/goals";
import * as membersSvc from "./services/members";
import type { UserDirectory } from "../auth/interfaces";
import type {
  WebsiteMutations,
  WebsiteQuery,
  WebsiteTrafficReads,
  WebsiteUserMutations,
} from "./interfaces";
import { toUpdateWebsiteInput } from "./lib/patch-mapping";
import { presentWebsite, presentWebsites } from "./lib/website-presenter";

/**
 * HTTP surface for websites, mounted at `/api/v1/websites`.
 *
 * Cutting these handlers onto `WebsiteService` closes a real defect. They previously
 * called `services/websites/crud.ts` directly, so a website created or updated through
 * the API emitted no `website.created` / `website.updated` and wrote no outbox row —
 * and because `CachedWebsiteQuery` invalidates on exactly those events, the tracker
 * could read stale `replayEnabled` / sampling settings for up to the cache TTL after
 * an update. Two write paths existed; only one of them announced anything.
 */
export function createWebsiteRoutes(deps: {
  /**
   * Interfaces rather than `WebsiteService`, and `Pick` on the unchecked writes on
   * purpose: `WebsiteMutations.update` / `.delete` / `.setPublicSharing` skip the
   * access check, and a handler reaching for one of those instead of its `ForUser`
   * counterpart is a missing authorization check that no test would necessarily
   * catch. Only `create` is exposed, which has no existing website to authorize
   * against.
   */
  websites: WebsiteQuery &
    WebsiteTrafficReads &
    WebsiteUserMutations &
    Pick<WebsiteMutations, "create">;
  /** Names and emails for the member list — `users` belongs to auth. */
  users: UserDirectory;
}) {
  const { websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  r.use("*", authMiddleware);

  /** Map a thrown access error onto its status, defaulting to 403. */
  function denied(c: Context, e: unknown): Response {
    const status = (e as Error & { status?: number }).status ?? 403;
    return c.json({ error: "forbidden" }, status as ContentfulStatusCode);
  }

  /**
   * Build a guarded handler.
   *
   * Every route here repeated the same preamble — resolve the user, answer 401 if
   * absent, then wrap the body in a try/catch that maps a thrown access error to its
   * status. That is now in one place, so no individual route can forget it.
   *
   * `handle` returns either a value, answered as JSON, or a `Response` for the
   * endpoints where the status matters (201, 204).
   */

  /**
   * A path segment the route declares.
   *
   * `c.req.param` is typed optional because a handler built by `authed` is generic
   * over the path; Hono only routes to it when the segment matched, so the fallback
   * is unreachable and would simply find nothing.
   */
  function param(c: Context<{ Variables: AuthVars }>, name: string): string {
    return c.req.param(name) ?? "";
  }

  function authed<T>(handle: (c: Context<{ Variables: AuthVars }>, userId: string) => Promise<T>) {
    return async (c: Context<{ Variables: AuthVars }>) => {
      const userId = requireUser(c);
      if (!userId) return c.json({ error: "unauthorized" }, 401);

      try {
        const out = await handle(c, userId);
        return out instanceof Response ? out : c.json(out as object);
      } catch (e) {
        return denied(c, e);
      }
    };
  }

  // ─── CRUD (on the new service) ────────────────────────────────────────────

  r.get("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const owned = await websites.listOwnedWithTraffic(userId);
    return c.json({ data: presentWebsites(owned) });
  });

  r.post("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const parsed = await parseJson(c, websiteCreateSchema);
    if (!parsed.ok) return parsed.res;

    try {
      const created = await websites.create(userId, {
        name: parsed.data.name,
        url: parsed.data.url,
      });
      // Nested under `website` — the shape this endpoint has always returned, and
      // the only one of these responses that is not a bare `data`.
      return c.json({ data: { website: presentWebsite(created) } }, 201);
    } catch (e) {
      // A hostname that will not parse is the expected failure here, and its message
      // is shown to the user.
      return c.json({ error: e instanceof Error ? e.message : "create failed" }, 400);
    }
  });

  r.get("/:id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    try {
      const website = await websites.getWithTraffic(param(c, "id"), userId);
      if (!website) return c.json({ error: "not found" }, 404);
      return c.json({ data: presentWebsite(website) });
    } catch (e) {
      return denied(c, e);
    }
  });

  r.put("/:id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const raw = await c.req.json().catch(() => null);
    const ok = websitePatchSchema.safeParse(raw);
    if (!ok.success) return validationErrorResponse(c, ok.error);

    try {
      const updated = await websites.updateForUser(
        param(c, "id"),
        userId,
        toUpdateWebsiteInput(ok.data),
      );
      if (!updated) return c.json({ error: "not found" }, 404);
      return c.json({ data: presentWebsite(updated) });
    } catch (e) {
      return denied(c, e);
    }
  });

  r.delete("/:id", authed(async (c, userId) => {
    await websites.deleteForUser(param(c, "id"), userId);
    return c.body(null, 204);
  }));

  r.post("/:id/share", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);

    const body = await c.req.json<{ enabled?: boolean }>().catch(() => ({ enabled: true }));

    try {
      const shareId = await websites.setPublicSharingForUser(
        param(c, "id"),
        userId,
        !!body.enabled,
      );
      return c.json({ data: { public_share_id: shareId } });
    } catch (e) {
      return denied(c, e);
    }
  });

  // ─── Goals (pending migration) ────────────────────────────────────────────

  r.get("/:id/goals", authed(async (c, userId) => {
    return c.json(await goalsSvc.listGoals(userId, param(c, "id")));
  }));

  r.post("/:id/goals", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, goalCreateSchema);
    if (!parsed.ok) return parsed.res;
    try {
      return c.json(
        await goalsSvc.createGoal(
          userId,
          param(c, "id"),
          parsed.data as Parameters<typeof goalsSvc.createGoal>[2],
        ),
        201,
      );
    } catch (e) {
      return denied(c, e);
    }
  });

  r.patch("/:id/goals/:goal_id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const raw = await c.req.json().catch(() => null);
    const ok = goalPatchSchema.safeParse(raw);
    if (!ok.success) return validationErrorResponse(c, ok.error);
    try {
      const out = await goalsSvc.updateGoal(
        userId,
        param(c, "id"),
        param(c, "goal_id"),
        ok.data as Parameters<typeof goalsSvc.updateGoal>[3],
      );
      if (!out) return c.json({ error: "not found" }, 404);
      return c.json(out);
    } catch (e) {
      return denied(c, e);
    }
  });

  r.delete("/:id/goals/:goal_id", authed(async (c, userId) => {
    await goalsSvc.deleteGoal(userId, param(c, "id"), param(c, "goal_id"));
    return c.body(null, 204);
  }));

  // ─── Membership and invitations (pending migration) ───────────────────────

  r.get("/:id/my-role", authed(async (c, userId) => {
    return c.json(await membersSvc.getMyRole(userId, param(c, "id")));
  }));

  r.get("/:id/members", authed(async (c, userId) => {
    return c.json(await membersSvc.listMembers(userId, param(c, "id"), deps.users));
  }));

  r.post("/:id/members", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, memberAddSchema);
    if (!parsed.ok) return parsed.res;
    try {
      return c.json(
        await membersSvc.addMember(
          userId,
          param(c, "id"),
          { email: parsed.data.email, role: parsed.data.role },
          deps.users,
        ),
        201,
      );
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "failed" }, 400);
    }
  });

  r.delete("/:id/members/:user_id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    try {
      await membersSvc.removeMember(userId, param(c, "id"), param(c, "user_id"));
      return c.body(null, 204);
    } catch (e) {
      return denied(c, e);
    }
  });

  r.put("/:id/members/:user_id/role", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, memberRoleSchema);
    if (!parsed.ok) return parsed.res;
    try {
      await membersSvc.updateMemberRole(
        userId,
        param(c, "id"),
        param(c, "user_id"),
        parsed.data.role,
      );
      return c.body(null, 204);
    } catch (e) {
      return denied(c, e);
    }
  });

  r.get("/:id/invitations", authed(async (c, userId) => {
    return c.json(await membersSvc.listInvitations(userId, param(c, "id")));
  }));

  r.post("/:id/invitations", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const body = await c.req
      .json<{ email?: string; role?: string }>()
      .catch((): { email?: string; role?: string } => ({}));
    if (!body.email) return c.json({ error: "email is required" }, 400);
    try {
      return c.json(
        await membersSvc.createInvitation(userId, param(c, "id"), {
          email: body.email,
          role: body.role ?? "viewer",
        }),
        201,
      );
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 400;
      return c.json(
        { error: e instanceof Error ? e.message : "failed" },
        status as ContentfulStatusCode,
      );
    }
  });

  r.delete("/:id/invitations/:invitation_id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    try {
      await membersSvc.revokeInvitation(
        userId,
        param(c, "id"),
        param(c, "invitation_id"),
      );
      return c.body(null, 204);
    } catch (e) {
      return denied(c, e);
    }
  });

  // ─── Stubs the dashboard calls ────────────────────────────────────────────
  // Present so the client gets a shaped answer rather than a 404; unimplemented
  // server-side. Preserved verbatim from the previous router.

  r.get("/:websiteId/privacy", (c) =>
    c.json({ data: { website_id: c.req.param("websiteId"), settings: {} } }),
  );
  r.put("/:websiteId/privacy", (c) => c.json({ data: { ok: true } }));

  // API keys are not here: `api_keys` is a platform-owned table, and the real surface
  // lives in `platform/public-api/keys/routes.ts`, mounted at these same paths.

  return r;
}
