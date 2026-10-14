import { describe, expect, it } from "bun:test";
import { validateAndSanitizeSQL } from "../services/ai-generated-sql-guard.service";

/**
 * The guard on LLM-authored SQL.
 *
 * This is the only thing standing between a hallucinated (or prompt-injected) query and
 * a live multi-tenant database, so it is tested as an adversary rather than as a
 * function: most of what follows is a table of queries that must be refused.
 *
 * It is no longer the tenant boundary on its own: since db/sql/054 the role the
 * statement runs as sees only the caller's website (row-level security, and a filtered
 * view for analytics_events). But it is the first line, and the "known bypasses" block
 * below records shapes that once passed it and read other tenants' rows.
 */

const ANALYTICS = ["analytics_events"];
const FUNNELS = ["funnels"];
const AUTOMATIONS = ["automations", "automation_events"];

/** The shape the domain prompts actually ask for — a baseline that must keep working. */
const VALID = "SELECT path, COUNT(*) AS views FROM analytics_events WHERE website_id = $1 GROUP BY path LIMIT 50";

function reject(sql: string, tables: string[] = ANALYTICS) {
  const r = validateAndSanitizeSQL(sql, tables);
  expect(r.ok).toBe(false);
  return r as { ok: false; reason: string };
}

function accept(sql: string, tables: string[] = ANALYTICS) {
  const r = validateAndSanitizeSQL(sql, tables);
  if (!r.ok) throw new Error(`expected accept, got: ${r.reason}`);
  return r;
}

describe("validateAndSanitizeSQL", () => {
  describe("cross-tenant reads", () => {
    /**
     * Each of these contains `$1`, names only whitelisted tables, and is a read-only
     * single SELECT — so an earlier version of this guard passed every one of them
     * straight through to the database.
     */
    it("rejects an inverted tenant filter", () => {
      // Returns every website except the caller's.
      reject("SELECT path FROM analytics_events WHERE website_id != $1 LIMIT 10");
      reject("SELECT path FROM analytics_events WHERE website_id <> $1 LIMIT 10");
    });

    it("rejects a neutralised tenant filter", () => {
      reject("SELECT path FROM analytics_events WHERE website_id = $1 OR 1=1 LIMIT 10");
      reject("SELECT path FROM analytics_events WHERE NOT website_id = $1 LIMIT 10");
    });

    it("rejects a range comparison standing in for the filter", () => {
      reject("SELECT path FROM analytics_events WHERE website_id > $1 LIMIT 10");
    });

    it("rejects $1 used somewhere that is not the tenant column", () => {
      // `$1` is present and a tenant predicate exists nowhere — the filter is on a
      // column the caller does not control.
      reject("SELECT path FROM analytics_events WHERE path = $1 LIMIT 10");
    });

    it("rejects a tenant predicate paired with a second, inverted use of $1", () => {
      reject(
        "SELECT path FROM analytics_events WHERE website_id = $1 AND website_id != $1 LIMIT 10",
      );
    });

    it("rejects an unfiltered scalar subquery beside a filtered outer query", () => {
      // The outer query is scoped correctly; the subquery counts every tenant's rows.
      reject(
        "SELECT (SELECT COUNT(*) FROM analytics_events) AS leak FROM analytics_events WHERE website_id = $1 LIMIT 10",
      );
    });

    it("rejects a CTE that reads the table unfiltered", () => {
      reject(
        "WITH everything AS (SELECT website_id, path FROM analytics_events) " +
        "SELECT path FROM everything WHERE website_id = $1 LIMIT 10",
      );
    });

    it("rejects a self-join scoped on only one side", () => {
      reject(
        "SELECT a.path FROM analytics_events a JOIN analytics_events b ON a.session_id = b.session_id " +
        "WHERE a.website_id = $1 LIMIT 10",
      );
    });

    it("accepts a self-join scoped on both sides", () => {
      accept(
        "SELECT a.path FROM analytics_events a JOIN analytics_events b ON a.session_id = b.session_id " +
        "WHERE a.website_id = $1 AND b.website_id = $1 LIMIT 10",
      );
    });

    it("accepts a multi-CTE query that repeats the predicate", () => {
      accept(
        "WITH cur AS (SELECT path FROM analytics_events WHERE website_id = $1), " +
        "prev AS (SELECT path FROM analytics_events WHERE website_id = $1) " +
        "SELECT COUNT(*) AS n FROM cur LIMIT 10",
      );
    });
  });

  describe("tables scoped through a join", () => {
    /**
     * `automation_events` has no `website_id` — it is keyed by `automation_id`, and the
     * automations prompt scopes it by joining `automations`. So it cannot be required to
     * carry its own predicate, and the rule for it is that the scope must be anchored by
     * one somewhere.
     */
    it("accepts the documented join shape", () => {
      accept(
        "SELECT ae.record_type, COUNT(*) AS n FROM automation_events ae " +
        "JOIN automations a ON ae.automation_id = a.id " +
        "WHERE a.website_id = $1::uuid GROUP BY ae.record_type LIMIT 50",
        AUTOMATIONS,
      );
    });

    it("rejects reading the join-scoped table on its own", () => {
      // No column to filter and nothing filtered joined to it: every tenant's rows.
      reject(
        "SELECT record_type, COUNT(*) AS n FROM automation_events GROUP BY record_type LIMIT 50",
        AUTOMATIONS,
      );
    });

    it("rejects an unanchored subquery over the join-scoped table", () => {
      reject(
        "SELECT (SELECT COUNT(*) FROM automation_events) AS leak FROM automations WHERE website_id = $1::uuid LIMIT 10",
        AUTOMATIONS,
      );
    });
  });

  describe("tenant predicate forms the prompts produce", () => {
    it("accepts a bare equality", () => {
      accept(VALID);
    });

    it("accepts a cast on the parameter", () => {
      accept("SELECT name FROM funnels WHERE website_id = $1::uuid LIMIT 10", FUNNELS);
      accept("SELECT path FROM analytics_events WHERE website_id = $1::text LIMIT 10");
    });

    it("rejects a cast on the column", () => {
      // The prompts say to cast the parameter; a column-side cast is also where an
      // expression would hide (`website_id::text = $1`).
      reject("SELECT name FROM funnels WHERE website_id::text = $1 LIMIT 10", FUNNELS);
      reject("SELECT f.name FROM funnels f WHERE f.website_id::text = $1 LIMIT 10", FUNNELS);
    });

    it("accepts a table-qualified predicate", () => {
      accept("SELECT e.path FROM analytics_events e WHERE e.website_id = $1 LIMIT 10");
    });

    it("accepts a qualified-and-cast predicate", () => {
      accept("SELECT f.name FROM funnels f WHERE f.website_id = $1::uuid LIMIT 10", FUNNELS);
    });
  });

  describe("ordinary SQL the guard must not refuse", () => {
    /**
     * Both of these were refused by a first draft of the tenant rules, and both appear
     * in the domain prompts — so the model would have been shown a shape that fails.
     */
    it("accepts a derived table", () => {
      // Lifting the subquery out must leave a placeholder, or `FROM (...) AS sessions`
      // reads as a table named `as`.
      accept(
        "SELECT ROUND(AVG(duration), 2) AS value FROM (" +
        "SELECT session_id, EXTRACT(EPOCH FROM (MAX(occurred_at) - MIN(occurred_at))) AS duration " +
        "FROM analytics_events WHERE website_id = $1 GROUP BY session_id) AS sessions LIMIT 10",
      );
    });

    it("accepts IS NOT NULL", () => {
      accept(
        "SELECT path FROM analytics_events WHERE website_id = $1 AND path IS NOT NULL LIMIT 10",
      );
    });

    it("still rejects a negated tenant predicate", () => {
      reject("SELECT path FROM analytics_events WHERE NOT (website_id = $1) LIMIT 10");
    });
  });

  describe("statement shape", () => {
    it("rejects anything that is not SELECT or WITH", () => {
      expect(reject("DELETE FROM analytics_events WHERE website_id = $1").reason).toContain(
        "Only SELECT",
      );
    });

    it("rejects statement chaining", () => {
      reject("SELECT path FROM analytics_events WHERE website_id = $1; SELECT 1");
    });

    it("rejects comments, which can hide a payload", () => {
      reject("SELECT path FROM analytics_events WHERE website_id = $1 -- AND 1=1");
      reject("SELECT path FROM analytics_events /* x */ WHERE website_id = $1");
    });

    it("rejects a query with no $1 at all", () => {
      reject("SELECT path FROM analytics_events LIMIT 10");
    });

    it("rejects parameters other than $1", () => {
      reject("SELECT path FROM analytics_events WHERE website_id = $1 AND path = $2 LIMIT 10");
    });
  });

  describe("write and admin keywords", () => {
    const cases = [
      "INSERT", "UPDATE", "DELETE", "DROP", "CREATE",
      "ALTER", "TRUNCATE", "GRANT", "REVOKE", "MERGE",
    ];
    for (const kw of cases) {
      it(`rejects ${kw} anywhere in the statement`, () => {
        expect(
          reject(`SELECT path FROM analytics_events WHERE website_id = $1 AND '${kw}' = x LIMIT 1`)
            .reason,
        ).toContain(kw);
      });
    }

    it("rejects a data-modifying CTE", () => {
      reject(
        "WITH gone AS (DELETE FROM analytics_events WHERE website_id = $1 RETURNING *) " +
        "SELECT * FROM gone",
      );
    });
  });

  describe("set operations", () => {
    /** With a single bound $1, a second branch can hard-code another tenant. */
    for (const op of ["UNION", "INTERSECT", "EXCEPT"]) {
      it(`rejects ${op}`, () => {
        reject(
          `SELECT path FROM analytics_events WHERE website_id = $1 ${op} SELECT path FROM analytics_events`,
        );
      });
    }
  });

  describe("dangerous functions and system catalogs", () => {
    it("rejects pg_sleep", () => {
      reject("SELECT pg_sleep(10) FROM analytics_events WHERE website_id = $1");
    });

    it("rejects file access", () => {
      reject("SELECT pg_read_file('/etc/passwd') FROM analytics_events WHERE website_id = $1");
    });

    it("rejects catalog enumeration", () => {
      reject("SELECT * FROM pg_catalog.pg_tables WHERE website_id = $1");
      reject("SELECT * FROM information_schema.tables WHERE website_id = $1");
    });

    it("rejects current_setting, which leaks connection configuration", () => {
      reject("SELECT current_setting('is_superuser') FROM analytics_events WHERE website_id = $1");
    });
  });

  describe("table whitelist", () => {
    it("rejects a table outside the domain", () => {
      // `users` is auth's, and no AI domain lists it.
      expect(reject("SELECT email FROM users WHERE website_id = $1 LIMIT 10").reason).toContain(
        "not allowed",
      );
    });

    it("rejects a schema-qualified reference", () => {
      reject("SELECT path FROM public.analytics_events WHERE website_id = $1 LIMIT 10");
    });

    it("allows a CTE name that is not a table", () => {
      accept(
        "WITH daily AS (SELECT path FROM analytics_events WHERE website_id = $1) " +
        "SELECT * FROM daily LIMIT 10",
      );
    });
  });

  describe("limit handling", () => {
    /** The cap is applied by wrapping, so nothing inside the statement can lift it. */
    const WRAP = /^SELECT \* FROM \(([\s\S]*)\) AS _q LIMIT (\d+)$/;

    it("adds a LIMIT when absent", () => {
      const r = accept("SELECT path FROM analytics_events WHERE website_id = $1");
      expect(r.sql).toBe("SELECT * FROM (SELECT path FROM analytics_events WHERE website_id = $1) AS _q LIMIT 500");
    });

    it("caps an oversized LIMIT", () => {
      const r = accept("SELECT path FROM analytics_events WHERE website_id = $1 LIMIT 99999");
      expect(r.sql).toMatch(WRAP);
      expect(r.sql).toEndWith(") AS _q LIMIT 1000");
    });

    it("caps a LIMIT written as an expression", () => {
      const r = accept("SELECT path FROM analytics_events WHERE website_id = $1 LIMIT 100*100000");
      expect(r.sql).toEndWith(") AS _q LIMIT 1000");
    });

    it("is not satisfied by a LIMIT inside a CTE", () => {
      const r = accept(
        "WITH few AS (SELECT path FROM analytics_events WHERE website_id = $1 LIMIT 5) " +
        "SELECT a.path FROM analytics_events a WHERE a.website_id = $1",
      );
      expect(r.sql).toMatch(WRAP);
      expect(WRAP.exec(r.sql)![2]).toBe("500");
    });

    it("wraps FETCH FIRST instead of appending a second LIMIT to it", () => {
      const r = accept("SELECT path FROM analytics_events WHERE website_id = $1 FETCH FIRST 5000 ROWS ONLY");
      expect(r.sql).toMatch(WRAP);
      expect(r.sql).not.toContain("ONLY LIMIT");
      expect(r.sql).toEndWith(") AS _q LIMIT 1000");
    });

    it("leaves a reasonable LIMIT alone", () => {
      const r = accept(VALID);
      expect(r.sql).toContain("LIMIT 50");
    });

    it("leaves the statement intact inside the wrapper", () => {
      const r = accept(VALID);
      expect(r.sql).toBe(`SELECT * FROM (${VALID}) AS _q LIMIT 1000`);
    });

    it("strips a trailing semicolon", () => {
      const r = accept("SELECT path FROM analytics_events WHERE website_id = $1 LIMIT 10;");
      expect(r.sql).not.toContain(";");
    });
  });

  describe("text that imitates a rule", () => {
    it("does not let a string literal stand in for the tenant predicate", () => {
      reject(
        "SELECT (SELECT count(*) FROM analytics_events WHERE 'website_id = $1' = 'website_id = $1') AS leak " +
        "FROM analytics_events WHERE website_id = $1",
      );
      reject(
        "SELECT path FROM analytics_events WHERE website_id = $1 AND session_id IN " +
        "(SELECT session_id FROM analytics_events WHERE 'website_id = $1' IS NOT NULL)",
      );
    });

    it("sees tables joined with a comma", () => {
      reject("SELECT u.email, u.password_hash FROM analytics_events e, users u WHERE e.website_id = $1");
      reject("SELECT 1 FROM analytics_events e JOIN funnels f ON f.id = e.id, users u WHERE e.website_id = $1", [
        "analytics_events", "funnels",
      ]);
    });

    it("refuses syntax that hides an identifier or a literal", () => {
      reject('SELECT * FROM analytics_events e, "users" WHERE e.website_id = $1');
      reject("SELECT $$x$$ FROM analytics_events WHERE website_id = $1");
      reject("SELECT E'\\x41' FROM analytics_events WHERE website_id = $1");
    });
  });
  describe("known bypasses", () => {
    /**
     * Each of these passed an earlier version of the guard and, run against the
     * database, returned another tenant's rows. The database now refuses them as well
     * (054), but the guard must not let them through.
     */
    it("rejects SQL hidden in a string literal and run by query_to_xml", () => {
      reject(
        "SELECT query_to_xml('select * from analytics_events', true, false, '') " +
        "FROM analytics_events WHERE website_id = $1 LIMIT 1",
      );
    });

    it("rejects the whole family of functions that execute SQL text", () => {
      for (const fn of [
        "query_to_xml_and_xmlschema('select 1', true, false, '')",
        "table_to_xml('analytics_events', true, false, '')",
        "cursor_to_xml('c', 1, true, false, '')",
        "schema_to_xml('public', true, false, '')",
        "database_to_xml(true, false, '')",
        "xpath('/x', '<x/>')",
        "xmlparse(document '<x/>')",
        "ts_stat('select to_tsvector(path) from analytics_events')",
        "ts_rewrite('a'::tsquery, 'select 1')",
      ]) {
        reject(`SELECT ${fn} FROM analytics_events WHERE website_id = $1 LIMIT 1`);
      }
    });

    it("rejects set_config, which could re-point the tenant setting", () => {
      reject("SELECT set_config('app.ai_website_id', 'x', true) FROM analytics_events WHERE website_id = $1");
      reject("SELECT current_setting('app.ai_website_id') FROM analytics_events WHERE website_id = $1");
    });

    it("rejects a boolean test that inverts the tenant predicate", () => {
      reject("SELECT * FROM analytics_events WHERE website_id = $1 IS FALSE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE website_id = $1 IS NOT TRUE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE website_id = $1 IS UNKNOWN LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE website_id = $1::text IS FALSE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE (website_id = $1) IS FALSE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE (website_id = $1) = FALSE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE website_id = $1 IS DISTINCT FROM TRUE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE website_id = $1 IS NOT DISTINCT FROM FALSE LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE website_id ISNULL AND website_id = $1 LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE path NOTNULL AND website_id = $1 LIMIT 10");
    });

    it("rejects the predicate anywhere but a WHERE / ON condition", () => {
      reject("SELECT *, website_id = $1 AS mine FROM analytics_events LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE CASE WHEN website_id = $1 THEN FALSE ELSE TRUE END LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE COALESCE(website_id = $1, TRUE) LIMIT 10");
      reject("SELECT * FROM analytics_events WHERE occurred_at IS NOT NULL HAVING website_id = $1");
      // A tenant condition in ON is allowed but does not scope the table: an outer join
      // keeps the rows it does not match.
      reject(
        "SELECT a.path FROM analytics_events a FULL JOIN analytics_events b " +
        "ON a.website_id = $1 AND b.website_id = $1 LIMIT 10",
      );
    });

    it("does not read the upper bound of a BETWEEN as a tenant condition", () => {
      reject("SELECT * FROM analytics_events WHERE path BETWEEN 'a' AND website_id = $1 LIMIT 10");
    });

    it("rejects a self-join that filters one alias twice", () => {
      reject(
        "SELECT a.path FROM analytics_events a JOIN analytics_events b ON a.id = b.id " +
        "WHERE a.website_id = $1 AND a.website_id = $1 LIMIT 10",
      );
      // Unqualified, the column would be ambiguous across two tenant tables anyway.
      reject(
        "SELECT a.path FROM analytics_events a JOIN analytics_events b ON a.id = b.id " +
        "WHERE website_id = $1 AND website_id = $1 LIMIT 10",
      );
    });

    it("rejects automation_events joined to a filtered automations on anything but its key", () => {
      reject(
        "SELECT ae.* FROM automation_events ae JOIN automations a ON a.id IS NOT NULL " +
        "WHERE a.website_id = $1 LIMIT 10",
        AUTOMATIONS,
      );
      reject(
        "SELECT ae.* FROM automation_events ae, automations a WHERE a.website_id = $1 LIMIT 10",
        AUTOMATIONS,
      );
      // Joined on its key, but to a parent that is not the filtered one.
      reject(
        "SELECT ae.* FROM automation_events ae JOIN automations x ON ae.automation_id = x.id " +
        "JOIN automations a ON a.id = a.id WHERE a.website_id = $1 LIMIT 10",
        AUTOMATIONS,
      );
    });

    it("accepts automation_events joined on its key to a filtered automations", () => {
      accept(
        "SELECT ae.status FROM automation_events ae, automations a " +
        "WHERE ae.automation_id = a.id AND a.website_id = $1::uuid LIMIT 10",
        AUTOMATIONS,
      );
      accept(
        "SELECT ae.status FROM automation_events ae JOIN automations a ON a.id = ae.automation_id " +
        "WHERE a.website_id = $1 LIMIT 10",
        AUTOMATIONS,
      );
    });

    it("rejects unbalanced parentheses", () => {
      reject("SELECT path FROM analytics_events WHERE website_id = $1) LIMIT 10");
    });
  });
});
