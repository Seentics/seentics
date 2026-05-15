// ─── Shared AI utilities ──────────────────────────────────────────────────────

export const AI_MODEL = "gpt-4o-mini";

/** GPT-4o-mini pricing (USD per token) */
export const COST_INPUT_PER_TOKEN = 0.00000015;
export const COST_OUTPUT_PER_TOKEN = 0.0000006;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIVizType = "table" | "bar_chart" | "line_chart" | "pie_chart" | "number";

export type AIDomain =
  | "analytics"
  | "revenue"
  | "replays"
  | "heatmaps"
  | "funnels"
  | "automations";

export interface AIHistoryItem {
  id: string;
  prompt: string;
  title: string | null;
  viz_type: string | null;
  status: string;
  created_at: string;
}

export interface AIResponse {
  sql: string;
  viz_type: AIVizType;
  title: string;
  insight: string;
  tips: string | string[];
  x_key: string | null;
  y_key: string | null;
  columns: Array<{ key: string; label: string }>;
}

export interface AIQueryResult {
  rows: Record<string, unknown>[];
  viz_type: AIVizType;
  title: string;
  insight: string | null;
  tips: string | null;
  x_key: string | null;
  y_key: string | null;
  columns: Array<{ key: string; label: string }>;
  sql: string;
  execution_time_ms: number;
  tokens: { input: number; output: number };
  estimated_cost_usd: number;
}

// ─── SQL safety ───────────────────────────────────────────────────────────────

/**
 * Validates and sanitises AI-generated SQL.
 * - Only SELECT statements allowed.
 * - Forbidden DML/DDL keywords are blocked.
 * - $1 (website_id parameter) must be present.
 * - Optionally whitelists table names found after FROM / JOIN.
 * - Caps LIMIT at 1000.
 */
export function validateAndSanitizeSQL(
  rawSql: string,
  allowedTables: string[] = [],
): { ok: true; sql: string } | { ok: false; reason: string } {
  const trimmed = rawSql.trim().replace(/;+$/, "");
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT")) {
    return { ok: false, reason: "Only SELECT statements are allowed" };
  }

  const forbidden = [
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "CALL",
  ];
  for (const kw of forbidden) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) {
      return { ok: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  // Ensure website_id parameter placeholder is always present
  if (!trimmed.includes("$1")) {
    return { ok: false, reason: "Query must include the website_id filter ($1)" };
  }

  // Table whitelist — extract tables referenced after FROM and JOIN
  if (allowedTables.length > 0) {
    const tablePattern = /\bFROM\s+(\w+)|\bJOIN\s+(\w+)/gi;
    let match: RegExpExecArray | null;
    while ((match = tablePattern.exec(trimmed)) !== null) {
      const table = (match[1] ?? match[2] ?? "").toLowerCase();
      if (table && !allowedTables.includes(table)) {
        return { ok: false, reason: `Table '${table}' is not allowed in this context` };
      }
    }
  }

  // Cap LIMIT at 1000
  const limitMatch = upper.match(/LIMIT\s+(\d+)/);
  if (limitMatch) {
    const val = parseInt(limitMatch[1], 10);
    if (val > 1000) {
      return { ok: true, sql: trimmed.replace(/LIMIT\s+\d+/i, "LIMIT 1000") };
    }
    return { ok: true, sql: trimmed };
  }

  return { ok: true, sql: trimmed + " LIMIT 500" };
}
