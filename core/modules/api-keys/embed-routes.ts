/**
 * Embed links from the dashboard — `/user/agency/embed-links`.
 *
 * A link shows a website's numbers (or all of a client's) to whoever holds its URL, so it
 * takes the role that may publish analytics: website admin or owner — the same bar as a
 * public share link — or, for a client, the client's owner.
 *
 *   GET    /       the owner's live links
 *   POST   /       `{ website_id }` or `{ client_id }` (+ optional `sections`): the target's
 *                  link, made if absent (an existing link is returned as is)
 *   PATCH  /:id    `{ sections }`: which sections the link exposes, effective at once
 *   DELETE /:id    revoke; making the link again yields a new URL
 */

import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseJson } from "../../platform/validation";
import { roleAtLeast, type WebsiteQuery } from "../websites/interfaces";
import type { ClientDirectory } from "../websites/interfaces";
import { normalizeSections, sectionsSchema } from "./interfaces/embed-sections";
import type { EmbedLinkRecord, EmbedLinks } from "./interfaces";

const createSchema = z
  .object({ website_id: z.string().uuid().optional(), client_id: z.string().uuid().optional(), sections: sectionsSchema.optional() })
  .refine((b) => Boolean(b.website_id) !== Boolean(b.client_id), { message: "Send exactly one of website_id and client_id" });

export function createEmbedLinkRoutes(deps: { embedLinks: EmbedLinks; websites: WebsiteQuery; clients: ClientDirectory }) {
  const r = new Hono<{ Variables: AuthVars }>();
  r.use("*", authMiddleware);

  /** The target's name when `userId` may share it, else `null`. */
  async function shareableName(userId: string, scope: EmbedLinkRecord["scope"], targetId: string): Promise<string | null> {
    if (scope === "website") {
      const role = await deps.websites.getRole(targetId, userId);
      if (!role || !roleAtLeast(role, "admin")) return null;
      return (await deps.websites.getById(targetId))?.name ?? null;
    }
    return (await deps.clients.getClient(userId, targetId))?.name ?? null;
  }

  r.get("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const links = await deps.embedLinks.listLive(userId);
    const views = await Promise.all(
      links.map(async (link) => {
        const name = await shareableName(userId, link.scope, link.targetId);
        return name === null ? null : deps.embedLinks.present(link, name);
      }),
    );
    return c.json({ data: views.filter((v) => v !== null) });
  });

  r.post("/", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, createSchema);
    if (!parsed.ok) return parsed.res;

    const scope = parsed.data.website_id ? "website" : "client";
    const targetId = (parsed.data.website_id ?? parsed.data.client_id)!;
    const name = await shareableName(userId, scope, targetId);
    if (name === null) return c.json({ error: "forbidden" }, 403);

    // The link belongs to the target's owner, so it shows in their list whoever made it.
    const ownerId = scope === "website" ? (await deps.websites.getById(targetId))!.ownerId : userId;
    const { link, created } = await deps.embedLinks.getOrCreate(
      ownerId,
      scope === "website" ? { websiteId: targetId } : { clientId: targetId },
      parsed.data.sections && normalizeSections(parsed.data.sections),
    );
    return c.json({ data: await deps.embedLinks.present(link, name) }, created ? 201 : 200);
  });

  r.patch("/:id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const parsed = await parseJson(c, z.object({ sections: sectionsSchema }));
    if (!parsed.ok) return parsed.res;
    const link = await deps.embedLinks.findById(c.req.param("id"));
    const name = link ? await shareableName(userId, link.scope, link.targetId) : null;
    if (!link || name === null) return c.json({ error: "not found" }, 404);
    const updated = await deps.embedLinks.setSections(link.id, parsed.data.sections);
    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json({ data: await deps.embedLinks.present(updated, name) });
  });

  r.delete("/:id", async (c) => {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    const link = await deps.embedLinks.findById(c.req.param("id"));
    // An unknown, revoked or unshareable link all read as not found.
    if (!link || (await shareableName(userId, link.scope, link.targetId)) === null) return c.json({ error: "not found" }, 404);
    await deps.embedLinks.revoke(link.id);
    return c.body(null, 204);
  });

  return r;
}
