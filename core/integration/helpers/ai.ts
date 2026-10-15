/**
 * Seeds for the AI integration files: rows the assistant, the alert check and the
 * recommendations loop would have written, inserted directly so a test can read them back
 * through the routes without a model.
 */
import { randomUUID } from "node:crypto";
import { sql } from "../harness";

export const ai = (path: string) => `/api/v1/ai${path}`;

/** One question in `ai_queries`, as the assistant records it. */
export async function seedQuery(opts: {
  userId: string;
  websiteId: string;
  prompt?: string;
  conversationId?: string | null;
  answer?: string | null;
  proposal?: unknown;
  status?: string;
  createdAt?: Date;
  appliedAt?: Date | null;
}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO ai_queries (user_id, website_id, prompt, conversation_id, answer, proposal, status, created_at, proposal_applied_at)
    VALUES (${opts.userId}::uuid, ${opts.websiteId}, ${opts.prompt ?? "How many visitors?"},
            ${opts.conversationId ?? null}::uuid, ${opts.answer ?? null},
            ${opts.proposal === undefined ? null : JSON.stringify(opts.proposal)}::jsonb,
            ${opts.status ?? "success"}, ${opts.createdAt ?? new Date()}, ${opts.appliedAt ?? null})
    RETURNING id::text`;
  return row!.id;
}

export async function seedAnomaly(websiteId: string, opts: { status?: "open" | "resolved"; type?: string; title?: string } = {}) {
  const now = new Date();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO ai_anomalies (website_id, type, subject, status, severity, metric, window_start, window_end, title, summary, resolved_at)
    VALUES (${websiteId}::uuid, ${opts.type ?? "traffic_drop"}, ${randomUUID()}, ${opts.status ?? "open"}, 'high', 'pageviews',
            ${new Date(now.getTime() - 3_600_000)}, ${now}, ${opts.title ?? "Traffic fell"}, 'Pageviews fell by half',
            ${opts.status === "resolved" ? now : null})
    RETURNING id::text`;
  return row!.id;
}

export async function seedRecommendation(websiteId: string, opts: { status?: string; title?: string } = {}) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO ai_recommendations (website_id, source, dedupe_key, title, rationale, prompt, status)
    VALUES (${websiteId}::uuid, 'insight', ${`key-${randomUUID()}`}, ${opts.title ?? "Fix the pricing page"},
            'Visitors leave it fast', 'Draft a fix for the pricing page', ${opts.status ?? "open"})
    RETURNING id::text`;
  return row!.id;
}
