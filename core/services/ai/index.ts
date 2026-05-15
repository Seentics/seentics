import OpenAI from "openai";
import { and, desc, eq } from "drizzle-orm";
import { db, sql, aiQueries, websites, websiteMembers } from "../../db";
import {
  AI_MODEL, COST_INPUT_PER_TOKEN, COST_OUTPUT_PER_TOKEN,
  validateAndSanitizeSQL,
  type AIDomain, type AIVizType, type AIHistoryItem, type AIResponse, type AIQueryResult,
} from "./shared";

import { ANALYTICS_PROMPT, ANALYTICS_TABLES } from "./domains/analytics";
import { REVENUE_PROMPT, REVENUE_TABLES } from "./domains/revenue";
import { REPLAYS_PROMPT, REPLAYS_TABLES } from "./domains/replays";
import { HEATMAPS_PROMPT, HEATMAPS_TABLES } from "./domains/heatmaps";
import { FUNNELS_PROMPT, FUNNELS_TABLES } from "./domains/funnels";
import { AUTOMATIONS_PROMPT, AUTOMATIONS_TABLES } from "./domains/automations";
import { resolveSiteId } from "../analytics/shared";

// ─── OpenAI singleton ─────────────────────────────────────────────────────────
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  if (!_openai) _openai = new OpenAI({ apiKey: key });
  return _openai;
}

// ─── Domain config registry ───────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<AIDomain, { prompt: string; tables: string[] }> = {
  analytics: { prompt: ANALYTICS_PROMPT, tables: ANALYTICS_TABLES },
  revenue: { prompt: REVENUE_PROMPT, tables: REVENUE_TABLES },
  replays: { prompt: REPLAYS_PROMPT, tables: REPLAYS_TABLES },
  heatmaps: { prompt: HEATMAPS_PROMPT, tables: HEATMAPS_TABLES },
  funnels: { prompt: FUNNELS_PROMPT, tables: FUNNELS_TABLES },
  automations: { prompt: AUTOMATIONS_PROMPT, tables: AUTOMATIONS_TABLES },
};

// ─── Website access check ─────────────────────────────────────────────────────

export async function checkWebsiteAccess(websiteId: string, userId: string): Promise<boolean> {
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

// ─── Domain Detection ─────────────────────────────────────────────────────────

async function detectDomain(prompt: string): Promise<AIDomain> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a routing assistant. Classify the user's analytics query into ONE of these domains: 'analytics', 'revenue', 'replays', 'heatmaps', 'funnels', 'automations'. Return ONLY the domain name as a lowercase string.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const domain = response.choices[0].message.content?.trim().toLowerCase() as AIDomain;
    const validDomains: AIDomain[] = ['analytics', 'revenue', 'replays', 'heatmaps', 'funnels', 'automations'];
    return validDomains.includes(domain) ? domain : 'analytics';
  } catch (err) {
    console.error("[AI] domain detection failed", err);
    return 'analytics';
  }
}

// ─── Main query function ──────────────────────────────────────────────────────

export async function runAIQuery(
  userId: string,
  websiteId: string,
  prompt: string,
  initialDomain: AIDomain | 'auto' = "auto",
): Promise<AIQueryResult> {
  const domain = initialDomain === 'auto' ? await detectDomain(prompt) : initialDomain;
  // domain resolved — no log needed here

  const { prompt: systemPrompt, tables: allowedTables } = DOMAIN_CONFIG[domain] ?? DOMAIN_CONFIG.analytics;
  const startedAt = Date.now();

  // ── Intelligent ID Resolution ──────────────────────────────────────────────
  // Map domains to their required ID format:
  // - Legacy 'site_id' string for Analytics, Revenue, and Replays.
  // - Modern 'uuid' for Heatmaps, Funnels, and Automations.
  const ID_STRATEGY: Record<AIDomain, "site_id" | "uuid"> = {
    analytics: "site_id",
    revenue: "site_id",
    replays: "site_id",
    heatmaps: "uuid",
    funnels: "uuid",
    automations: "uuid",
  };

  const { siteId, uuid } = await resolveSiteId(websiteId);
  const dbBoundId = ID_STRATEGY[domain] === "site_id" ? siteId : uuid;

  // Insert pending record to track the attempt
  const [inserted] = await db
    .insert(aiQueries)
    .values({ userId, websiteId, prompt, model: AI_MODEL, status: "pending" })
    .returning({ id: aiQueries.id });

  const queryId = inserted?.id ?? null;

  try {
    // ── Call GPT-4o-mini ─────────────────────────────────────────────────────
    const openai = getOpenAI();

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

    // ── Validate & sanitise SQL ───────────────────────────────────────────────
    const validation = validateAndSanitizeSQL(aiResp.sql, allowedTables);
    if (!validation.ok) {
      throw new Error(`Unsafe SQL: ${validation.reason}`);
    }
    const safeSql = validation.sql;

    // ── Execute query (website_id is always $1) ───────────────────────────────
    let rows: Record<string, unknown>[];
    try {
      rows = (await sql.unsafe(safeSql, [dbBoundId])) as Record<string, unknown>[];
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      throw new Error(`Query execution failed: ${msg}`);
    }

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
      const title = aiResp.title || "Query Results";
      const insight = aiResp.insight || null;
      const tips = Array.isArray(aiResp.tips) ? aiResp.tips.join("\n") : (aiResp.tips || null);
      const vizType = aiResp.viz_type ?? "table";
      const xKey = aiResp.x_key ?? null;
      const yKey = aiResp.y_key ?? null;

      await db.update(aiQueries).set({
        systemContext: systemPrompt.slice(0, 2000),
        generatedSql: safeSql,
        vizType,
        title,
        insight,
        tips,
        xKey,
        yKey,
        columns,
        rowCount: rows.length,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        status: "success",
        executionTimeMs,
      }).where(eq(aiQueries.id, queryId));
    }

    return {
      rows,
      viz_type: (aiResp.viz_type ?? "table") as AIVizType,
      title: aiResp.title ?? "Query Results",
      insight: aiResp.insight ?? null,
      tips: Array.isArray(aiResp.tips) ? aiResp.tips.join("\n") : (aiResp.tips || null),
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
