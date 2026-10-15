/**
 * The AI routes with a model configured — a fake one. A local server speaks the OpenAI
 * chat-completions API (the `openai-compatible` provider, as for a self-hosted model), so the
 * real client, budget wrapper, agent loop, SQL guard and repository all run, and no request
 * ever leaves the machine. The server counts requests, which is how a test proves a refused
 * question cost nothing.
 */
import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

type Reply = (body: any) => Response;
const replies: Reply[] = [];
const seen: any[] = [];

const completion = (message: Record<string, unknown>, finish = "stop") =>
  Response.json({
    id: `cmpl-${randomUUID()}`, object: "chat.completion", created: 0, model: "fake-model",
    choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: finish }],
    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
  });
const text = (content: string): Reply => () => completion({ content });

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const body = await req.json().catch(() => null);
    seen.push(body);
    const next = replies.shift();
    return next ? next(body) : completion({ content: "Default fake answer." });
  },
});

// Before the application is composed: the AI module reads these when it is built, and the
// assistant's per-user cap when its file is imported. A small cap keeps the cap tests cheap.
Object.assign(process.env, {
  AI_PROVIDER: "openai-compatible",
  AI_BASE_URL: `http://127.0.0.1:${server.port}/v1`,
  AI_API_KEY: "fake-key",
  AI_MODEL: "fake-model",
  AI_MAX_QUERIES_PER_DAY: "3",
});
const { api, seedUser, seedWebsite, sql } = await import("./harness");
const { ai, seedQuery } = await import("./helpers/ai");

afterAll(() => server.stop(true));
beforeEach(() => {
  replies.length = 0;
  seen.length = 0;
});

async function siteWithOwner() {
  const owner = await seedUser();
  const site = await seedWebsite(owner.id);
  return { owner, site };
}

/** Fill a user's rolling-24h allowance with earlier questions. */
async function useUpAllowance(userId: string, websiteId: string) {
  for (let i = 0; i < 3; i++) await seedQuery({ userId, websiteId, prompt: `earlier ${i}` });
}

describe("with a model configured", () => {
  it("reports AI as configured", async () => {
    const u = await seedUser();
    expect((await api("GET", ai("/status"), { token: u.token })).body).toEqual({ data: { configured: true } });
  });
});

describe("POST /ai/chat", () => {
  it("answers, and records the turn in a conversation", async () => {
    const { owner, site } = await siteWithOwner();
    replies.push(text("You had 42 visitors this week."));
    const res = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "How many visitors this week?" } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ answer: "You had 42 visitors this week.", proposal: null, tokens: { input: 11, output: 7 } });
    expect(seen).toHaveLength(1);
    // The question reaches the model wrapped as data, with the site's tools on offer.
    expect(JSON.stringify(seen[0].messages)).toContain("<question>How many visitors this week?</question>");
    expect(seen[0].tools.length).toBeGreaterThan(0);

    const rows = await sql<{ id: string; status: string; answer: string; conversation_id: string; model: string }[]>`
      SELECT id::text, status, answer, conversation_id::text, model FROM ai_queries WHERE website_id = ${site.id}`;
    expect([...rows]).toEqual([{ id: res.body.queryId, status: "success", answer: "You had 42 visitors this week.", conversation_id: res.body.conversationId, model: "fake-model" }]);
  });

  it("replays earlier turns of the same conversation to the model", async () => {
    const { owner, site } = await siteWithOwner();
    replies.push(text("42 visitors."));
    const first = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "Visitors this week?" } });
    replies.push(text("38 the week before."));
    const second = await api("POST", ai(`/chat/${site.id}`), {
      token: owner.token, body: { prompt: "And the week before?", conversation_id: first.body.conversationId },
    });
    expect(second.status).toBe(200);
    expect(second.body.conversationId).toBe(first.body.conversationId);
    const replayed = JSON.stringify(seen[1].messages);
    expect(replayed).toContain("Visitors this week?");
    expect(replayed).toContain("42 visitors.");

    const turns = await api("GET", ai(`/conversation/${site.id}/${first.body.conversationId}`), { token: owner.token });
    expect(turns.body.turns.map((t: { answer: string }) => t.answer)).toEqual(["42 visitors.", "38 the week before."]);
  });

  it("refuses past the daily cap with 429, without calling the model or recording a row", async () => {
    const { owner, site } = await siteWithOwner();
    await useUpAllowance(owner.id, site.id);
    const res = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "Visitors?" } });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/daily limit/i);
    expect(seen).toHaveLength(0);
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ai_queries WHERE user_id = ${owner.id}::uuid`;
    expect(n!.n).toBe(3);
  });

  it("counts the cap per user, not per site", async () => {
    // Questions on another site still use up the same person's allowance.
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    await useUpAllowance(owner.id, other.id);
    expect((await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "Visitors?" } })).status).toBe(429);
    expect(seen).toHaveLength(0);
  });

  it("hides the provider's error behind a generic 502 and marks the turn failed", async () => {
    const { owner, site } = await siteWithOwner();
    // Twice: the client retries once.
    const fail: Reply = () => Response.json({ error: { message: "sk-secret-123 quota exceeded for org-xyz" } }, { status: 500 });
    replies.push(fail, fail);
    const res = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "Visitors?" } });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "The assistant could not answer just now. Try again." });
    expect(res.text).not.toContain("sk-secret");
    const [row] = await sql<{ status: string }[]>`SELECT status FROM ai_queries WHERE website_id = ${site.id}`;
    expect(row!.status).toBe("error");
  });

  it("stores a draft the model proposes, and confirming it applies the stored payload", async () => {
    const { owner, site } = await siteWithOwner();
    replies.push(() => completion({
      content: null,
      tool_calls: [{ id: "call_1", type: "function", function: { name: "propose_goal", arguments: JSON.stringify({ name: "Reached pricing", type: "pageview", identifier: "/pricing" }) } }],
    }, "tool_calls"));
    replies.push(text("I drafted a goal for the pricing page. Confirm it to create it."));
    const res = await api("POST", ai(`/chat/${site.id}`), { token: owner.token, body: { prompt: "Track visits to pricing as a goal" } });
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ resource: "goal", operation: "create" });
    const [n0] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM goals WHERE website_id = ${site.id}::uuid`;
    expect(n0!.n).toBe(0);

    const ok = await api("POST", ai(`/confirm/${site.id}/${res.body.queryId}`), { token: owner.token });
    expect(ok.status).toBe(200);
    const goals = await sql<{ name: string; identifier: string }[]>`SELECT name, identifier FROM goals WHERE website_id = ${site.id}::uuid`;
    expect([...goals]).toEqual([{ name: "Reached pricing", identifier: "/pricing" }]);
  });
});

describe("POST /ai/query", () => {
  it("runs the model's SELECT as the read-only tenant role against this site only", async () => {
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    for (const [w, page] of [[site.id, "/mine"], [site.id, "/mine"], [other.id, "/theirs"]] as const) {
      await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
                VALUES (${w}, 'pageview', ${page}, ${randomUUID()}, ${randomUUID()}, now())`;
    }
    replies.push(text(JSON.stringify({
      sql: "SELECT page, COUNT(*) AS views FROM analytics_events WHERE website_id = $1 GROUP BY page ORDER BY views DESC LIMIT 10",
      viz_type: "table", title: "Top pages",
    })));
    const res = await api("POST", ai(`/query/${site.id}`), { token: owner.token, body: { prompt: "Top pages by views", domain: "analytics" } });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Top pages");
    expect(res.body.data.rows.map((r: { page: string; views: unknown }) => [r.page, Number(r.views)])).toEqual([["/mine", 2]]);
    // An explicit domain skips the classifier: one model call.
    expect(seen).toHaveLength(1);
    const history = await api("GET", ai(`/history/${site.id}`), { token: owner.token });
    expect(history.body.data[0]).toMatchObject({ prompt: "Top pages by views", status: "success", title: "Top pages" });
  });

  it("still sees only the bound site when a statement gets past the text guard unscoped", async () => {
    // Defence in depth: the read-only role's row-level policy, not the text guard, is the last
    // word on tenancy. Run straight through the repository, as the guard would never pass this.
    const { PostgresAiRepository } = await import("../modules/ai/repositories/postgres-ai.repository");
    const { owner, site } = await siteWithOwner();
    const other = await seedWebsite(owner.id);
    for (const w of [site.id, other.id]) {
      await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at)
                VALUES (${w}, 'pageview', '/p', ${randomUUID()}, ${randomUUID()}, now())`;
    }
    const rows = await new PostgresAiRepository().runGuarded(
      `SELECT DISTINCT website_id FROM analytics_events WHERE website_id IN ('${site.id}', '${other.id}') AND $1::text IS NOT NULL`,
      site.id,
    );
    expect(rows.map((r) => r.website_id)).toEqual([site.id]);
    // And it cannot write.
    await expect(new PostgresAiRepository().runGuarded("DELETE FROM analytics_events WHERE website_id = $1", site.id)).rejects.toThrow();
    const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM analytics_events WHERE website_id = ${site.id}`;
    expect(n!.n).toBe(1);
  });

  it("answers a repeated question from the cache without a second model call", async () => {
    const { owner, site } = await siteWithOwner();
    replies.push(text(JSON.stringify({ sql: "SELECT COUNT(*) AS n FROM analytics_events WHERE website_id = $1", title: "Count" })));
    const body = { prompt: "How many events?", domain: "analytics" };
    expect((await api("POST", ai(`/query/${site.id}`), { token: owner.token, body })).status).toBe(200);
    expect((await api("POST", ai(`/query/${site.id}`), { token: owner.token, body })).status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it("refuses a statement that writes, without echoing it back", async () => {
    const { owner, site } = await siteWithOwner();
    replies.push(text(JSON.stringify({ sql: "DELETE FROM analytics_events", title: "oops" })));
    const res = await api("POST", ai(`/query/${site.id}`), { token: owner.token, body: { prompt: "Clean up my data", domain: "analytics" } });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "AI query failed" });
    expect(res.text).not.toMatch(/DELETE|Unsafe/);
    const [row] = await sql<{ status: string; error_message: string }[]>`SELECT status, error_message FROM ai_queries WHERE website_id = ${site.id}`;
    expect(row!.status).toBe("error");
    expect(row!.error_message).toMatch(/Unsafe SQL/);
  });

  it("refuses past the daily cap with 429 before classifying the question", async () => {
    // With domain "auto" the classifier is a model call of its own: it must not be made either.
    const { owner, site } = await siteWithOwner();
    await useUpAllowance(owner.id, site.id);
    const res = await api("POST", ai(`/query/${site.id}`), { token: owner.token, body: { prompt: "Top pages" } });
    expect(res.status).toBe(429);
    expect(seen).toHaveLength(0);
  });
});
