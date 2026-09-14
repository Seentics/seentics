import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { AIDailyLimitError } from "../interfaces/ai.interface";
import type { AiAgent, AiProposalApplier } from "../interfaces/ai-agent.interface";
import type { AiControllerDeps } from "./ai-controller.types";

const MAX_PROMPT_CHARS = 2_000;

async function requireAccess(
  c: Context<{ Variables: AuthVars }>,
  deps: AiControllerDeps,
  websiteRef: string,
): Promise<{ userId: string } | Response> {
  const userId = requireUser(c);
  if (!userId) return c.json({ error: "forbidden" }, 403);
  if (!(await deps.websites.getRole(websiteRef, userId))) {
    return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);
  }
  return { userId };
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

    try {
      const result = await deps.agent.ask({
        userId: access.userId,
        websiteId: websiteRef,
        prompt,
        conversationId,
      });
      return c.json(result);
    } catch (err) {
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
 */
export function confirmProposal(
  deps: AiControllerDeps & { applier: AiProposalApplier },
) {
  return async (c: Context<{ Variables: AuthVars }>) => {
    const websiteRef = c.req.param("website_id") ?? "";
    const access = await requireAccess(c, deps, websiteRef);
    if (access instanceof Response) return access;

    const queryId = c.req.param("query_id") ?? "";
    try {
      const result = await deps.applier.apply({
        userId: access.userId,
        websiteId: websiteRef,
        queryId,
      });
      if (!result.ok) return c.json({ error: result.error }, 400);
      return c.json({ ok: true, created: result.created });
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
