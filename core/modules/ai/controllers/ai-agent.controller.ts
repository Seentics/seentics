import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { AIDailyLimitError, AiNotConfiguredError } from "../interfaces/ai.interface";
import type { AiAgent, AiProposalApplier } from "../interfaces/ai-agent.interface";
import type { AiControllerDeps } from "./ai-controller.types";
import { roleAtLeast, type WebsiteRole } from "../../websites/interfaces";
import { can, type Permission } from "../../../platform/permissions";

const MAX_PROMPT_CHARS = 2_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: AiControllerDeps,
  websiteRef: string,
  minimum: WebsiteRole = "viewer",
): Promise<{ userId: string; role: WebsiteRole } | Response> {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "forbidden" }, 403);
  const role = await deps.websites.getRole(websiteRef, userId);
  if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);
  if (!roleAtLeast(role, minimum)) {
    // Read by the proposal card, so it says why rather than just "forbidden".
    return c.json({ error: "Viewers cannot confirm drafts. Ask a member, admin or the owner to confirm it." }, 403 as ContentfulStatusCode);
  }
  return { userId, role };
}

export function askAgent(deps: AiControllerDeps & { agent: AiAgent }) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const websiteRef = c.req.param("website_id") ?? "";
    const access = await requireAccess(c, deps, websiteRef);
    if (access instanceof Response) return access;

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid request body" }, 400);
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return c.json({ error: "prompt is required" }, 400);
    // Bounded before anything is charged: a megabyte of prose is not a question, and the
    // cost of the call is proportional to what is sent.
    if (prompt.length > MAX_PROMPT_CHARS) {
      return c.json({ error: `prompt must be ${MAX_PROMPT_CHARS} characters or fewer` }, 400);
    }

    const conversationId =
      typeof body.conversation_id === "string" ? body.conversation_id : undefined;
    // A recommendation id is only a label carried to the confirm step, which checks it belongs
    // to this website before acting on it. Anything that is not a UUID is dropped here.
    const recommendationId =
      typeof body.recommendation_id === "string" && UUID.test(body.recommendation_id)
        ? body.recommendation_id
        : undefined;

    try {
      const result = await deps.agent.ask({
        userId: access.userId,
        websiteId: websiteRef,
        prompt,
        conversationId,
        recommendationId,
      });
      return c.json(result);
    } catch (err) {
      if (err instanceof AiNotConfiguredError) return c.json({ error: err.message }, 503);
      if (err instanceof AIDailyLimitError) {
        return c.json({ error: err.message }, 429);
      }
      return c.json(
        { error: err instanceof Error ? err.message : "AI request failed" },
        502 as ContentfulStatusCode,
      );
    }
  };
}

/**
 * Apply a draft the user approved.
 *
 * The payload comes from the stored row, never from this request. A client could
 * otherwise send back a different automation than the one that was shown and approved,
 * which would make the confirmation screen decorative.
 *
 * Who may confirm depends on what the draft changes (settings need an admin, the rest a
 * member), so the role is handed to the applier, which owns that table. Statuses: 403 for a
 * role or team permission, 409 for a stale draft, 404 for one whose target is gone.
 */
export function confirmProposal(
  deps: AiControllerDeps & { applier: AiProposalApplier },
) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const websiteRef = c.req.param("website_id") ?? "";
    // A viewer may ask the assistant to draft something, but never confirm it; the applier
    // raises the bar further for settings.
    const access = await requireAccess(c, deps, websiteRef, "member");
    if (access instanceof Response) return access;

    const queryId = c.req.param("query_id") ?? "";
    try {
      const result = await deps.applier.apply({
        userId: access.userId,
        websiteId: websiteRef,
        queryId,
        role: access.role,
        can: (permission) => can(c, permission as Permission),
      });
      if (!result.ok) {
        const status = result.code === "forbidden" ? 403 : result.code === "stale" ? 409 : result.code === "gone" ? 404 : 400;
        return c.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, status);
      }
      return c.json({ ok: true, created: result.created, operation: result.operation });
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Could not apply the proposal" },
        400,
      );
    }
  };
}

export function getConversation(deps: AiControllerDeps & { agent: AiAgent }) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const access = await requireAccess(c, deps, c.req.param("website_id") ?? "");
    if (access instanceof Response) return access;

    const turns = await deps.agent.conversation(access.userId, c.req.param("conversation_id") ?? "");
    return c.json({ turns });
  };
}

export function listConversations(deps: AiControllerDeps & { agent: AiAgent }) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const websiteRef = c.req.param("website_id") ?? "";
    const access = await requireAccess(c, deps, websiteRef);
    if (access instanceof Response) return access;

    const conversations = await deps.agent.conversations(access.userId, websiteRef);
    return c.json({ conversations });
  };
}
