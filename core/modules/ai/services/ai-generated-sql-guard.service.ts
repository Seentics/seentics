/**
 * Validates and sanitises AI-generated SQL.
 *
 * This is defence in depth, not the tenant boundary. The boundary is the database:
 * `runGuarded` runs the statement read-only, with a statement timeout, as
 * `seentics_ai_readonly`, with `app.ai_website_id` set to the caller's website, and that
 * role sees only that website's rows (row-level security plus a filtered view for
 * analytics_events — db/sql/054). Text checks like the ones below were bypassed in
 * practice (SQL inside a string literal executed by `query_to_xml`, `website_id = $1 IS
 * FALSE`, a self-join with only one side filtered, ...), which is why that boundary
 * exists. These checks still run: they refuse what the model should never write, and keep
 * the statements the database sees simple.
 *
 * - Only a single SELECT statement is allowed.
 * - SQL comments, quoted identifiers, dollar-quoting and escape strings are rejected.
 * - Forbidden DML/DDL/admin keywords and dangerous functions are blocked, including every
 *   function that executes SQL text (`query_to_xml` and the rest of the `*_to_xml`
 *   family, `ts_stat`, `ts_rewrite`, ...) and `set_config` / `current_setting`, which
 *   could re-point the tenant setting the database checks.
 * - Set-operations (UNION/EXCEPT/INTERSECT), OR, and NOT (except `IS NOT NULL`) are
 *   blocked, as are `IS [NOT] TRUE/FALSE/UNKNOWN/DISTINCT` and `ISNULL`/`NOTNULL`: each
 *   can invert or neutralise a tenant predicate.
 * - System catalogs (pg_catalog / information_schema / pg_*) are blocked.
 * - Table names after FROM / JOIN must be in the domain whitelist.
 * - Every `$1` must be a whole top-level `[alias.]website_id = $1[::uuid|::text]`
 *   condition of a WHERE or ON clause — not in the select list, not inside an
 *   expression, never with a cast on the column side.
 * - In every scope (outer query, CTE body, subquery), every physical table with a
 *   `website_id` column is filtered in WHERE by a predicate on its own alias, and a
 *   table scoped through a join (`automation_events`) is joined on its key to a filtered
 *   parent.
 * - The row count is capped by wrapping: `SELECT * FROM (<sql>) AS _q LIMIT <cap>`.
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

  // Syntax that hides identifiers or text from the checks below is refused, not parsed: quoted
  // identifiers (`FROM "users"`), dollar-quoting, escape strings and backslashes.
  if (/["`\\]|\$\$|\$[A-Za-z_]|\b[EUeu]&?'/.test(trimmed)) {
    return { ok: false, reason: "Quoted identifiers, dollar-quoting and escape strings are not allowed" };
  }
  // Every check reads the statement with its string literals emptied. A literal that merely
  // *spells* `website_id = $1`, or a table name, must neither satisfy a rule nor hide from one.
  const text = maskLiterals(trimmed);
  if (text === null) return { ok: false, reason: "Unterminated string literal" };
  const upper = text.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { ok: false, reason: "Only SELECT statements are allowed" };
  }

  // No statement chaining — a mid-string ';' means a second statement.
  if (text.includes(";")) {
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
  // Read unmasked: a keyword inside a literal is refused too, which costs nothing real.
  const rawUpper = trimmed.toUpperCase();
  for (const kw of forbidden) {
    if (new RegExp(`\\b${kw}\\b`).test(rawUpper)) {
      return { ok: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  // Dangerous functions / identifiers (DoS, file access, catalog enumeration, and anything
  // that executes SQL text or touches settings). Read unmasked, so a name inside a string
  // literal — `query_to_xml('select set_config(...)')` — is refused as well.
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
    // SQL-in-a-string executors: query_to_xml, table_to_xml, cursor_to_xml, schema_to_xml,
    // database_to_xml and their *_and_xmlschema / *_to_xmlschema variants; the XML
    // functions generally (xpath, xmlparse, xmltable, ...); full-text functions that run a
    // query given as text.
    [/\w*_TO_XML\w*/i, "*_to_xml function"],
    [/\b(?:QUERY|TABLE|CURSOR|SCHEMA|DATABASE)_TO_\w+/i, "*_to_* query function"],
    [/\bXPATH\w*/i, "xpath"],
    [/\bXML\w*/i, "xml function"],
    [/\bTS_STAT\b/i, "ts_stat"],
    [/\bTS_REWRITE\b/i, "ts_rewrite"],
    [/\bTIMESCALEDB\w*|\b_TIMESCALEDB\w*/i, "timescaledb internals"],
  ];
  for (const [re, label] of forbiddenPatterns) {
    if (re.test(trimmed)) {
      return { ok: false, reason: `Forbidden reference: ${label}` };
    }
  }

  // `OR`/`NOT` can neutralise an otherwise-correct tenant predicate
  // (`website_id = $1 OR 1=1`), and no analytics question needs either.
  if (/\bOR\b/.test(upper)) {
    return { ok: false, reason: "OR is not allowed — use IN (...) instead" };
  }
  // `IS NOT NULL` is ordinary SQL and cannot invert a tenant predicate, so it alone is
  // exempted. `IS NOT TRUE/FALSE/DISTINCT` can (`website_id = $1 IS NOT TRUE`).
  const withoutIsNotNull = upper.replace(/\bIS\s+NOT\s+NULL\b/g, "IS NULL");
  if (/\bNOT\b/.test(withoutIsNotNull)) {
    return { ok: false, reason: "NOT is not allowed (except IS NOT NULL)" };
  }
  // Boolean tests turn a predicate into its own inverse: `website_id = $1 IS FALSE`.
  if (/\bIS\s+(?:TRUE|FALSE|UNKNOWN|DISTINCT)\b|\bISNULL\b|\bNOTNULL\b/.test(upper)) {
    return { ok: false, reason: "Only IS NULL / IS NOT NULL tests are allowed" };
  }

  // Ensure website_id parameter placeholder is present (and no other $N params).
  if (!text.includes("$1")) {
    return { ok: false, reason: "Query must include the website_id filter ($1)" };
  }
  if (/\$(?!1\b)\d+/.test(text)) {
    return { ok: false, reason: "Only the $1 (website_id) parameter is allowed" };
  }

  // CTE names (defined as `<name> AS (`) are local aliases, not tables.
  const cteNames = new Set<string>();
  const ctePattern = /\b([A-Za-z_]\w*)\s+AS\s*\(/gi;
  let cteMatch: RegExpExecArray | null;
  while ((cteMatch = ctePattern.exec(text)) !== null) {
    cteNames.add((cteMatch[1] ?? "").toLowerCase());
  }

  let allowed: Set<string> | undefined;
  if (allowedTables.length > 0) {
    allowed = new Set([...allowedTables.map((t) => t.toLowerCase()), ...cteNames]);
    const tablePattern = /\bFROM\s+([A-Za-z_][\w.]*)|\bJOIN\s+([A-Za-z_][\w.]*)/gi;
    let match: RegExpExecArray | null;
    while ((match = tablePattern.exec(text)) !== null) {
      const table = (match[1] ?? match[2] ?? "").toLowerCase();
      if (!table) continue;
      // Reject any schema-qualified reference (e.g. pg_catalog.x) and anything off-whitelist.
      if (table.includes(".") || !allowed.has(table)) {
        return { ok: false, reason: `Table '${table}' is not allowed in this context` };
      }
    }
  }

  const top = liftGroups(text);
  if (!top) return { ok: false, reason: "Unbalanced parentheses" };

  // Each scope is checked on its own: a tenant predicate only constrains the scope it is
  // in. See `checkScope`.
  const result = checkScope(text, cteNames, allowed);
  if (result.reason) return { ok: false, reason: result.reason };
  if (result.predicates === 0) {
    return { ok: false, reason: "Query must filter on website_id = $1" };
  }

  // Cap the row count by wrapping, so no LIMIT written anywhere — in a CTE, as an
  // expression, as FETCH FIRST — can lift it. The outer query's own LIMIT, when it has one
  // and it is lower, still applies inside the wrapper.
  const cap = /\b(?:LIMIT|FETCH)\b/i.test(top.own) ? 1000 : 500;
  return { ok: true, sql: `SELECT * FROM (${trimmed}) AS _q LIMIT ${cap}` };
}

/**
 * Tables with no `website_id` column of their own.
 *
 * `automation_events` is keyed by `automation_id`; tenancy reaches it by joining
 * `automations`, which is where the domain prompt puts the filter. Requiring a
 * predicate directly on it would reject that domain's own documented query shape, so it
 * is checked differently — see `checkScope`. Keep this in step with `db/schema.ts`:
 * a table added here that *does* have the column silently loses its own check.
 */
export const TENANT_BY_JOIN: ReadonlySet<string> = new Set(["automation_events"]);

/** For each `TENANT_BY_JOIN` table: the key column and the parent table it must join to. */
const TENANT_PARENT: Record<string, { fk: string; parent: string }> = {
  automation_events: { fk: "automation_id", parent: "automations" },
};

/** A whole tenant condition: `[alias.]website_id = $1[::uuid|::text]`. */
const PREDICATE = /^(?:([A-Za-z_]\w*)\s*\.\s*)?website_id\s*=\s*\$1(?:\s*::\s*(?:uuid|text))?$/i;

/** Keywords that end a WHERE clause in a scope whose parenthesised groups are lifted out. */
const CLAUSE_END = "GROUP|ORDER|HAVING|LIMIT|OFFSET|WINDOW|FETCH|FOR";
const JOIN_KW = "(?:(?:INNER|LEFT|RIGHT|FULL|CROSS|NATURAL)\\s+)?(?:OUTER\\s+)?JOIN";

interface TableRef {
  name: string;
  alias: string;
}

/**
 * Check one scope and, recursively, every scope nested in it.
 *
 * A "scope" is the statement text with its parenthesised groups lifted out: the outer
 * query is one, every CTE body is one, and so is every subquery — derived table, scalar
 * subquery, `IN (...)`. Within a scope:
 *
 * - every `$1` must be a whole conjunct of a WHERE or ON clause matching `PREDICATE`;
 * - every physical table that has `website_id` must be filtered by a WHERE conjunct on
 *   its own alias (an unqualified one counts only when it is the scope's only such
 *   table) — ON conditions do not count, since an outer join keeps unmatched rows;
 * - every `TENANT_BY_JOIN` table must be joined on its key to a filtered parent.
 *
 * Returns the first failure, and the number of tenant predicates seen.
 */
function checkScope(
  sql: string,
  cteNames: ReadonlySet<string>,
  allowed?: ReadonlySet<string>,
): { reason: string | null; predicates: number } {
  const lifted = liftGroups(sql);
  if (!lifted) return { reason: "Unbalanced parentheses", predicates: 0 };
  const { own, groups } = lifted;

  const refs: TableRef[] = [];
  for (const ref of tablesInScope(own)) {
    if (cteNames.has(ref.name)) continue;
    // Off the domain's list, wherever it is written — a comma join included.
    if (allowed && (ref.name.includes(".") || !allowed.has(ref.name))) {
      return { reason: `Table '${ref.name}' is not allowed in this context`, predicates: 0 };
    }
    refs.push(ref);
  }

  const whereConjuncts = sections(own, new RegExp(`\\bWHERE\\b([\\s\\S]*?)(?=\\b(?:${CLAUSE_END})\\b|$)`, "gi"))
    .flatMap(conjuncts);
  const onConjuncts = sections(
    own,
    new RegExp(`\\bON\\b([\\s\\S]*?)(?=\\b${JOIN_KW}\\b|\\bWHERE\\b|\\b(?:${CLAUSE_END})\\b|,|$)`, "gi"),
  ).flatMap(conjuncts);

  const whereQuals: string[] = [];
  let predicates = 0;
  for (const c of whereConjuncts) {
    const m = PREDICATE.exec(c);
    if (m) {
      whereQuals.push((m[1] ?? "").toLowerCase());
      predicates++;
    }
  }
  for (const c of onConjuncts) if (PREDICATE.test(c)) predicates++;

  const params = own.match(/\$1\b/g)?.length ?? 0;
  if (params !== predicates) {
    return {
      reason: "$1 may only be used as a whole `website_id = $1` condition of a WHERE or ON clause",
      predicates,
    };
  }

  const direct = refs.filter((r) => !TENANT_BY_JOIN.has(r.name));
  const byJoin = refs.filter((r) => TENANT_BY_JOIN.has(r.name));
  const covered = (r: TableRef) =>
    whereQuals.includes(r.alias) || (direct.length === 1 && whereQuals.includes(""));

  for (const r of direct) {
    if (!covered(r)) {
      return {
        reason: `Every table reference must be filtered by its own website_id = $1 in WHERE (unscoped: ${r.name}${r.alias !== r.name ? ` ${r.alias}` : ""})`,
        predicates,
      };
    }
  }

  // A table with no website_id is in scope only through a join on its key to a parent that
  // is itself filtered: `ae.automation_id = a.id`, `a` being a filtered `automations`.
  for (const r of byJoin) {
    const { fk, parent } = TENANT_PARENT[r.name]!;
    const parents = direct.filter((d) => d.name === parent).map((d) => d.alias);
    const childQual = byJoin.length === 1 ? `(?:${escapeRe(r.alias)}\\s*\\.\\s*)?` : `${escapeRe(r.alias)}\\s*\\.\\s*`;
    const anchored = parents.some((p) => {
      const child = `${childQual}${fk}`;
      const par = `${escapeRe(p)}\\s*\\.\\s*id`;
      const re = new RegExp(`^(?:${child}\\s*=\\s*${par}|${par}\\s*=\\s*${child})$`, "i");
      return [...whereConjuncts, ...onConjuncts].some((c) => re.test(c));
    });
    if (!anchored) {
      return {
        reason: `${r.name} must be joined on ${fk} = <${parent} alias>.id to a filtered ${parent}`,
        predicates,
      };
    }
  }

  for (const g of groups) {
    const inner = checkScope(g, cteNames, allowed);
    if (inner.reason) return inner;
    predicates += inner.predicates;
  }
  return { reason: null, predicates };
}

/**
 * Split a statement into its own text and its top-level parenthesised groups. Each group
 * is replaced by `()` in the own text, so `FROM (subquery) AS x` does not become
 * `FROM  AS x` — which reads as a table called `as`. Null on unbalanced parentheses.
 */
function liftGroups(sql: string): { own: string; groups: string[] } | null {
  const groups: string[] = [];
  let own = "";
  let depth = 0;
  let start = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") {
      if (depth === 0) {
        own += sql.slice(start, i);
        start = i + 1;
      }
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth < 0) return null;
      if (depth === 0) {
        groups.push(sql.slice(start, i));
        own += "()";
        start = i + 1;
      }
    }
  }
  if (depth !== 0) return null;
  own += sql.slice(start);
  return { own, groups };
}

/** The captured bodies of every match of `re` (which must be global, with one group). */
function sections(own: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(own)) !== null) {
    out.push(m[1] ?? "");
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

/**
 * The top-level AND-ed conditions of a WHERE / ON body, trimmed. The `AND` of a
 * `BETWEEN x AND y` is not a conjunction: the piece after it is folded back into the
 * piece holding the BETWEEN, so `a BETWEEN 1 AND website_id = $1` is never read as a
 * standalone tenant condition.
 */
function conjuncts(body: string): string[] {
  const out: string[] = [];
  let pendingBetween = 0;
  for (const piece of body.split(/\bAND\b/i)) {
    if (pendingBetween > 0 && out.length > 0) {
      out[out.length - 1] += " AND " + piece;
      pendingBetween--;
    } else {
      out.push(piece);
    }
    pendingBetween += piece.match(/\bBETWEEN\b/gi)?.length ?? 0;
  }
  return out.map((c) => c.trim());
}

/** The statement with every string literal emptied to `''`; null when one is unterminated. */
function maskLiterals(sql: string): string | null {
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch !== "'") { out += ch; continue; }
    i++;
    for (;;) {
      if (i >= sql.length) return null;
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") { i += 2; continue; }
        break;
      }
      i++;
    }
    out += "''";
  }
  return out;
}

const NOT_AN_ALIAS = new Set([
  "on", "using", "where", "group", "order", "having", "limit", "offset", "window", "fetch",
  "for", "join", "inner", "left", "right", "full", "cross", "natural", "outer", "tablesample",
]);

/**
 * Every physical table a scope reads, with the alias it is read under (its own name when
 * it has none), including the ones after a comma (`FROM events e, users u` is a join with
 * no JOIN keyword). `scope` has its parenthesised groups already lifted out.
 */
function tablesInScope(scope: string): TableRef[] {
  const tables: TableRef[] = [];
  const fromList = new RegExp(`\\bFROM\\s+([\\s\\S]*?)(?=\\b(?:WHERE|${CLAUSE_END})\\b|$)`, "gi");
  let m: RegExpExecArray | null;
  while ((m = fromList.exec(scope)) !== null) {
    for (const piece of (m[1] ?? "").split(",")) {
      const parts = piece.split(new RegExp(`\\b${JOIN_KW}\\b`, "i"));
      for (const part of parts) {
        const hit = /^\s*(?:LATERAL\s+|ONLY\s+)?([A-Za-z_][\w.]*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/i.exec(part);
        if (!hit?.[1]) continue;
        const name = hit[1].toLowerCase();
        const alias = hit[2] && !NOT_AN_ALIAS.has(hit[2].toLowerCase()) ? hit[2].toLowerCase() : name;
        tables.push({ name, alias });
      }
    }
  }
  return tables;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
