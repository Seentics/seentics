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
 * Validates and sanitises AI-generated SQL. This is defense-in-depth on top of the
 * read-only, statement-timeout transaction the query actually runs in (see runAIQuery).
 *
 * - Only a single SELECT statement is allowed.
 * - SQL comments are stripped-then-rejected (they hide payloads and split scoping).
 * - Extra `;` (statement chaining) is rejected.
 * - Forbidden DML/DDL/admin keywords and dangerous functions are blocked.
 * - Set-operations (UNION/EXCEPT/INTERSECT) are blocked: with a single required $1
 *   they are a cross-tenant graft vector (a second branch can hard-code another
 *   website_id), and analytics questions never need them.
 * - System catalogs (pg_catalog / information_schema / pg_*) are blocked.
 * - $1 (website_id parameter) must be present.
 * - Table names after FROM / JOIN must be in the domain whitelist.
 * - Caps LIMIT at 1000; adds LIMIT 500 when absent.
 */
export function validateAndSanitizeSQL(
  rawSql: string,
  allowedTables: string[] = [],
): { ok: true; sql: string } | { ok: false; reason: string } {
  // Reject comments outright — a `--` or `/* */` can smuggle payloads past keyword checks.
  if (/--|\/\*|\*\//.test(rawSql)) {
    return { ok: false, reason: "SQL comments are not allowed" };
  }

  const trimmed = rawSql.trim().replace(/;+\s*$/, "");
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { ok: false, reason: "Only SELECT statements are allowed" };
  }

  // No statement chaining — a mid-string ';' means a second statement.
  if (trimmed.includes(";")) {
    return { ok: false, reason: "Multiple statements are not allowed" };
  }

  // Data-modifying keywords (dangerous even inside a WITH ... AS (DELETE ... RETURNING)
  // CTE — the read-only tx also blocks those, this is belt-and-suspenders) plus
  // set-operations, which with a single required $1 are a cross-tenant graft vector.
  const forbidden = [
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
    "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "CALL", "MERGE",
    "UNION", "INTERSECT", "EXCEPT",
  ];
  for (const kw of forbidden) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) {
      return { ok: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  // Dangerous functions / identifiers (DoS, file access, system catalog enumeration).
  const forbiddenPatterns: [RegExp, string][] = [
    [/\bPG_SLEEP\b/i, "pg_sleep"],
    [/\bPG_READ_FILE\b/i, "pg_read_file"],
    [/\bPG_LS_DIR\b/i, "pg_ls_dir"],
    [/\bLO_\w+/i, "large-object function"],
    [/\bDBLINK\b/i, "dblink"],
    [/\bPG_CATALOG\b/i, "pg_catalog"],
    [/\bINFORMATION_SCHEMA\b/i, "information_schema"],
    [/\bPG_[A-Z_]*\b/i, "pg_* system object"],
    [/\bCURRENT_SETTING\b/i, "current_setting"],
    [/\bSET_CONFIG\b/i, "set_config"],
  ];
  for (const [re, label] of forbiddenPatterns) {
    if (re.test(trimmed)) {
      return { ok: false, reason: `Forbidden reference: ${label}` };
    }
  }

  // Ensure website_id parameter placeholder is present (and no other $N params).
  if (!trimmed.includes("$1")) {
    return { ok: false, reason: "Query must include the website_id filter ($1)" };
  }
  if (/\$(?!1\b)\d+/.test(trimmed)) {
    return { ok: false, reason: "Only the $1 (website_id) parameter is allowed" };
  }

  // Table whitelist — extract tables referenced after FROM and JOIN. CTE names
  // (defined as `<name> AS (`) are local aliases, so add them to the allow-set.
  if (allowedTables.length > 0) {
    const cteNames = new Set<string>();
    const ctePattern = /\b([A-Za-z_]\w*)\s+AS\s*\(/gi;
    let cteMatch: RegExpExecArray | null;
    while ((cteMatch = ctePattern.exec(trimmed)) !== null) {
      cteNames.add((cteMatch[1] ?? "").toLowerCase());
    }
    const allowed = new Set([...allowedTables.map((t) => t.toLowerCase()), ...cteNames]);

    const tablePattern = /\bFROM\s+([A-Za-z_][\w.]*)|\bJOIN\s+([A-Za-z_][\w.]*)/gi;
    let match: RegExpExecArray | null;
    while ((match = tablePattern.exec(trimmed)) !== null) {
      const table = (match[1] ?? match[2] ?? "").toLowerCase();
      if (!table) continue;
      // Reject any schema-qualified reference (e.g. pg_catalog.x) and anything off-whitelist.
      if (table.includes(".") || !allowed.has(table)) {
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
