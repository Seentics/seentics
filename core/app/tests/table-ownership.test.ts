import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Every table has exactly one owning module, and only that module may query it.
 *
 * The import-based check in `module-boundaries.test.ts` cannot see this class of
 * violation at all: raw SQL and Drizzle builders reach another module's table without
 * importing a single thing from it. Twenty such accesses existed across eleven files
 * when this was first measured — a "count everything" helper in `platform/lib` querying
 * six modules' tables, the tracker's website lookup holding its own SQL against
 * `websites` and `goals`, the raw API projecting `analytics_events` itself.
 *
 * Two detector details are load-bearing:
 *
 * - **Untagged template literals are stripped.** The AI module's prompts are long
 *   strings full of `FROM heatmap_points` and column listings — they are what the model
 *   is told about the schema, not queries. Counting them produced seven false positives
 *   and made this module look like the worst offender in the codebase.
 * - **Tagged templates are kept, including `sql<Row[]>` and `pgSql`.** An early version
 *   stripped anything preceded by `>`, which silently missed every generic-typed query —
 *   the exact form `tracker-website.repository.ts` uses. A detector with a false
 *   negative is worse than none, because it reads as a clean bill of health.
 */

const CORE = resolve(import.meta.dir, "..", "..");

/**
 * Who owns what.
 *
 * `users` is auth's: names and emails reach other modules through `UserDirectory`.
 * `goals` is websites' — the CRUD lives there — even though analytics computes
 * conversions from it (see the exemption below).
 */
const TABLE_OWNER: Record<string, string> = {
  websites: "websites",
  website_members: "websites",
  website_invitations: "websites",
  goals: "websites",
  analytics_events: "analytics",
  ai_queries: "ai",
  funnels: "funnels",
  automations: "automations",
  automation_events: "automations",
  user_profiles: "automations",
  session_replays: "recordings",
  heatmap_points: "heatmaps",
  heatmap_page_snapshots: "heatmaps",
  users: "auth",
  api_keys: "platform",
};

/** Drizzle identifier → table name, for the builder form. */
const DRIZZLE_IDENT: Record<string, string> = {
  websites: "websites",
  websiteMembers: "website_members",
  websiteInvitations: "website_invitations",
  goals: "goals",
  analyticsEvents: "analytics_events",
  aiQueries: "ai_queries",
  funnels: "funnels",
  automations: "automations",
  automationEvents: "automation_events",
  userProfiles: "user_profiles",
  sessionReplays: "session_replays",
  heatmapPoints: "heatmap_points",
  heatmapPageSnapshots: "heatmap_page_snapshots",
  users: "users",
  apiKeys: "api_keys",
};

/**
 * Accesses that stay, with the reason.
 *
 * Each is a case where routing through a port would make the system worse, not better.
 * Adding an entry here should require the same scrutiny as the code it excuses.
 */
const ALLOWED: { file: string; tables: string[]; why: string }[] = [
  {
    file: "modules/websites/repositories/postgres-website.repository.ts",
    tables: ["analytics_events", "automations", "funnels"],
    why:
      "Cascade delete. Deleting a website removes its analytics rows, automations and " +
      "funnels in one transaction. Routing those through ports means either a " +
      "distributed transaction or event-driven cleanup, and the latter leaves orphaned " +
      "rows whenever a consumer fails — a durability regression, not a refactor.",
  },
  {
    file: "modules/analytics/repositories/goals.repository.ts",
    tables: ["goals"],
    why:
      "Goal conversion is one indexable CTE that joins goal definitions to events. " +
      "Splitting it means fetching definitions through a port and then matching in " +
      "application code or via a VALUES list, which turns a planned join into two round " +
      "trips on the goals dashboard. `goals` is genuinely shared: websites owns the " +
      "CRUD, analytics owns the aggregation.",
  },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "tests" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Strip comments and prompt strings, keep tagged SQL templates. */
function queryableSource(file: string): string {
  let src = readFileSync(file, "utf8");
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  src = src.replace(/\/\/.*/g, "");
  // A tagged template is preceded by an identifier char, `>` (closing a generic) or `]`.
  return src.replace(/(?<![A-Za-z_$0-9>\]])`(?:[^`\\]|\\.)*`/gs, "``");
}

/** Which owned tables this file actually queries. */
function tablesQueried(file: string): string[] {
  const src = queryableSource(file);
  const found = new Set<string>();

  for (const table of Object.keys(TABLE_OWNER)) {
    if (new RegExp(`\\b(?:FROM|INTO|UPDATE|JOIN)\\s+${table}\\b`, "i").test(src)) {
      found.add(table);
    }
  }
  for (const [ident, table] of Object.entries(DRIZZLE_IDENT)) {
    if (new RegExp(`\\.(?:from|insert|update|delete|into)\\(\\s*${ident}\\b`).test(src)) {
      found.add(table);
    }
  }
  return [...found];
}

/** Which module or layer a file belongs to. */
function zoneOf(rel: string): string {
  const parts = rel.split("/");
  return parts[0] === "modules" ? parts[1]! : parts[0]!;
}

function isAllowed(rel: string, table: string): boolean {
  return ALLOWED.some((a) => a.file === rel && a.tables.includes(table));
}

describe("table ownership", () => {
  const files = [
    ...sourceFiles(join(CORE, "modules")),
    ...sourceFiles(join(CORE, "platform")),
    ...sourceFiles(join(CORE, "app")),
  ];

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("only the owning module queries a table", () => {
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(CORE, file);
      const zone = zoneOf(rel);

      for (const table of tablesQueried(file)) {
        if (TABLE_OWNER[table] === zone) continue;
        if (isAllowed(rel, table)) continue;
        violations.push(`${rel} queries ${table} (owned by ${TABLE_OWNER[table]})`);
      }
    }

    expect(violations).toEqual([]);
  });

  /**
   * An exemption for a file that no longer queries the table is a stale excuse, and it
   * would quietly permit the access coming back.
   */
  it("has no stale exemptions", () => {
    const stale: string[] = [];

    for (const entry of ALLOWED) {
      const queried = tablesQueried(join(CORE, entry.file));
      for (const table of entry.tables) {
        if (!queried.includes(table)) {
          stale.push(`${entry.file} no longer queries ${table} — drop it from ALLOWED`);
        }
      }
    }

    expect(stale).toEqual([]);
  });

  /** Every exemption carries a reason, so the next reader can judge it. */
  it("documents every exemption", () => {
    for (const entry of ALLOWED) {
      expect(entry.why.length).toBeGreaterThan(80);
    }
  });
});
