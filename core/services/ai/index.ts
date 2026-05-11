import OpenAI from "openai";
import { and, desc, eq } from "drizzle-orm";
import { db, sql, aiQueries, websites, websiteMembers } from "../../db";
import {
  AI_MODEL, COST_INPUT_PER_TOKEN, COST_OUTPUT_PER_TOKEN,
  validateAndSanitizeSQL,
  type AIDomain, type AIHistoryItem, type AIResponse, type AIQueryResult,
} from "./shared";
import { ANALYTICS_PROMPT, ANALYTICS_TABLES } from "./domains/analytics";
import { REVENUE_PROMPT, REVENUE_TABLES } from "./domains/revenue";
import { REPLAYS_PROMPT, REPLAYS_TABLES } from "./domains/replays";
import { HEATMAPS_PROMPT, HEATMAPS_TABLES } from "./domains/heatmaps";
import { FUNNELS_PROMPT, FUNNELS_TABLES } from "./domains/funnels";
import { AUTOMATIONS_PROMPT, AUTOMATIONS_TABLES } from "./domains/automations";

// ─── Domain config registry ───────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<AIDomain, { prompt: string; tables: string[] }> = {
  analytics:   { prompt: ANALYTICS_PROMPT,   tables: ANALYTICS_TABLES },
  revenue:     { prompt: REVENUE_PROMPT,     tables: REVENUE_TABLES },
  replays:     { prompt: REPLAYS_PROMPT,     tables: REPLAYS_TABLES },
  heatmaps:    { prompt: HEATMAPS_PROMPT,    tables: HEATMAPS_TABLES },
  funnels:     { prompt: FUNNELS_PROMPT,     tables: FUNNELS_TABLES },
  automations: { prompt: AUTOMATIONS_PROMPT, tables: AUTOMATIONS_TABLES },
};

// ─── Website access check ─────────────────────────────────────────────────────

export async function checkWebsiteAccess(websiteId: string, userId: string): Promise<boolean> {
  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);

  if (!site) return false;

  const [owner] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, userId)))
    .limit(1);

  if (owner) return true;

  const [member] = await db
    .select({ id: websiteMembers.id })
    .from(websiteMembers)
    .where(and(eq(websiteMembers.websiteId, websiteId), eq(websiteMembers.userId, userId)))
    .limit(1);

  return !!member;
}

// ─── Main query function ──────────────────────────────────────────────────────

export async function runAIQuery(
  userId: string,
  websiteId: string,
  prompt: string,
  domain: AIDomain = "analytics",
): Promise<AIQueryResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured");

  const { prompt: systemPrompt, tables: allowedTables } = DOMAIN_CONFIG[domain] ?? DOMAIN_CONFIG.analytics;
  const startedAt = Date.now();

  // Insert pending record to track the attempt
  const [inserted] = await db
    .insert(aiQueries)
    .values({ userId, websiteId, prompt, model: AI_MODEL, status: "pending" })
    .returning({ id: aiQueries.id });

  const queryId = inserted?.id ?? null;

  console.log("[AI] query start", { queryId, domain, userId, websiteId, prompt: prompt.slice(0, 120) });

  try {
    // ── Call GPT-4o-mini ─────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: openaiKey });

    console.log("[AI] openai request", { model: AI_MODEL, domain, max_tokens: 800, temperature: 0.1 });

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "";
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens = completion.usage?.total_tokens ?? 0;
    const estimatedCostUsd = (inputTokens * COST_INPUT_PER_TOKEN) + (outputTokens * COST_OUTPUT_PER_TOKEN);

    console.log("[AI] openai response", {
      model: completion.model,
      domain,
      finish_reason: completion.choices[0]?.finish_reason,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      cost_usd: `$${estimatedCostUsd.toFixed(6)}`,
      latency_ms: Date.now() - startedAt,
    });

    // ── Parse AI response ─────────────────────────────────────────────────────
    let aiResp: AIResponse;
    try {
      aiResp = JSON.parse(rawContent) as AIResponse;
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    if (!aiResp.sql || typeof aiResp.sql !== "string") {
      throw new Error("AI did not return a SQL query");
    }

    console.log("[AI] ai parsed", {
      domain,
      viz_type: aiResp.viz_type,
      title: aiResp.title,
      x_key: aiResp.x_key,
      y_key: aiResp.y_key,
      columns: aiResp.columns?.map((c) => c.key),
    });

    console.log("[AI] generated SQL:\n" + aiResp.sql);

    // ── Validate & sanitise SQL ───────────────────────────────────────────────
    const validation = validateAndSanitizeSQL(aiResp.sql, allowedTables);
    if (!validation.ok) {
      console.log("[AI] sql rejected", { domain, reason: validation.reason, sql: aiResp.sql.slice(0, 200) });
      throw new Error(`Unsafe SQL: ${validation.reason}`);
    }
    const safeSql = validation.sql;

    const sqlModified = safeSql !== aiResp.sql.trim().replace(/;+$/, "");
    console.log("[AI] sql validated", { domain, modified: sqlModified, ...(sqlModified && { safe_sql: safeSql }) });

    // ── Execute query (website_id is always $1) ───────────────────────────────
    const sqlStartedAt = Date.now();
    let rows: Record<string, unknown>[];
    try {
      rows = (await sql.unsafe(safeSql, [websiteId])) as Record<string, unknown>[];
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.log("[AI] sql error", { domain, error: msg, sql: safeSql.slice(0, 200) });
      throw new Error(`Query execution failed: ${msg}`);
    }

    const sqlMs = Date.now() - sqlStartedAt;
    console.log("[AI] sql executed", { domain, rows: rows.length, sql_ms: sqlMs });

    // ── Derive column list ────────────────────────────────────────────────────
    const columns: Array<{ key: string; label: string }> = aiResp.columns?.length
      ? aiResp.columns
      : rows.length > 0
        ? Object.keys(rows[0]).map((k) => ({
            key: k,
            label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          }))
        : [];

    const executionTimeMs = Date.now() - startedAt;

    // ── Persist success record ────────────────────────────────────────────────
    if (queryId) {
      await db.update(aiQueries).set({
        systemContext: systemPrompt.slice(0, 2000),
        generatedSql: safeSql,
        vizType: aiResp.viz_type ?? "table",
        title: aiResp.title ?? "Query Results",
        insight: aiResp.insight ?? null,
        xKey: aiResp.x_key ?? null,
        yKey: aiResp.y_key ?? null,
        columns,
        rowCount: rows.length,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        status: "success",
        executionTimeMs,
      }).where(eq(aiQueries.id, queryId));
    }

    console.log("[AI] query complete", {
      queryId,
      domain,
      total_ms: executionTimeMs,
      rows: rows.length,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: `$${estimatedCostUsd.toFixed(6)}`,
    });

    return {
      rows,
      viz_type: aiResp.viz_type ?? "table",
      title: aiResp.title ?? "Query Results",
      insight: aiResp.insight ?? null,
      x_key: aiResp.x_key ?? null,
      y_key: aiResp.y_key ?? null,
      columns,
      sql: safeSql,
      execution_time_ms: executionTimeMs,
      tokens: { input: inputTokens, output: outputTokens },
      estimated_cost_usd: estimatedCostUsd,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("[AI] query failed", {
      queryId,
      domain,
      error: errorMessage,
      total_ms: Date.now() - startedAt,
    });
    if (queryId) {
      await db.update(aiQueries).set({
        status: "error",
        errorMessage,
        executionTimeMs: Date.now() - startedAt,
      }).where(eq(aiQueries.id, queryId));
    }
    throw err;
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export async function getAIQueryHistory(
  userId: string,
  websiteId: string,
  limit = 8,
): Promise<AIHistoryItem[]> {
  const rows = await db
    .select({
      id: aiQueries.id,
      prompt: aiQueries.prompt,
      title: aiQueries.title,
      viz_type: aiQueries.vizType,
      status: aiQueries.status,
      created_at: aiQueries.createdAt,
    })
    .from(aiQueries)
    .where(and(eq(aiQueries.userId, userId), eq(aiQueries.websiteId, websiteId)))
    .orderBy(desc(aiQueries.createdAt))
    .limit(Math.min(limit, 20));

  return rows.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
  }));
}

// Re-export shared types for external consumers
export type { AIDomain, AIHistoryItem, AIQueryResult } from "./shared";
