import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { agencyAlerts, agencyWhiteLabel, clientMembers } from "../../../db/schema";

/**
 * Migration 070 and the Drizzle schema describe the same tables. The integration suite runs
 * the migration against Postgres; this keeps the two in step without a database.
 */
const SQL_DIR = join(import.meta.dir, "..", "..", "..", "db", "sql");
const sql = readFileSync(join(SQL_DIR, "070_agency_workspace.sql"), "utf8");
const squash = (s: string) => s.replace(/\s+/g, " ");
const columns = (t: Parameters<typeof getTableConfig>[0]) => getTableConfig(t).columns.map((c) => c.name);

describe("migration 070", () => {
  it("is the newest Core migration", () => {
    const files = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(files[files.length - 1]).toBe("070_agency_workspace.sql");
  });

  it("creates client_members keyed by (client, user), cascading from clients and users", () => {
    const s = squash(sql);
    expect(s).toContain("CREATE TABLE IF NOT EXISTS client_members");
    expect(s).toContain("client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE");
    expect(s).toContain("user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE");
    expect(s).toContain("PRIMARY KEY (client_id, user_id)");
    expect(s).toContain("CREATE INDEX IF NOT EXISTS ix_client_members_user ON client_members (user_id)");
    expect(s).toContain("CHECK (status IN ('invited', 'active', 'disabled'))");
    expect(columns(clientMembers).sort()).toEqual(["client_id", "invited_at", "last_seen_at", "name", "owner_id", "status", "user_id"]);
  });

  it("renames features_enabled to collect_features, adds dashboard_features and archived, keeps limits", () => {
    const s = squash(sql);
    expect(s).toContain("RENAME COLUMN features_enabled TO collect_features");
    expect(s).toContain("ADD COLUMN IF NOT EXISTS dashboard_features JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(s).toContain("CHECK (status IN ('active', 'suspended', 'archived'))");
    expect(s).not.toMatch(/DROP COLUMN IF EXISTS limits/);
    // From the source: another suite's fake `db` module can stand in for this table object.
    const schema = readFileSync(join(SQL_DIR, "..", "schema.ts"), "utf8");
    expect(schema).toContain('jsonb("collect_features")');
    expect(schema).toContain('jsonb("dashboard_features")');
    expect(schema).toContain('jsonb("limits")');
    expect(schema).not.toContain('"features_enabled"');
  });

  it("adds a unique, checked slug to the white label", () => {
    const s = squash(sql);
    expect(s).toContain("ADD COLUMN IF NOT EXISTS slug VARCHAR(40)");
    expect(s).toContain("CREATE UNIQUE INDEX IF NOT EXISTS ux_agency_white_label_slug ON agency_white_label (slug)");
    expect(s).toContain("slug ~ '^[a-z0-9-]{3,40}$'");
    expect(columns(agencyWhiteLabel)).toContain("slug");
  });

  it("creates agency_alerts, once per (owner, client, website, kind, resource, period) with NULLs equal", () => {
    const s = squash(sql);
    expect(s).toContain("CREATE TABLE IF NOT EXISTS agency_alerts");
    expect(s).toContain("UNIQUE NULLS NOT DISTINCT (owner_id, client_id, website_id, kind, resource, period)");
    expect(s).toContain("CHECK (kind IN ('cap_80', 'cap_100', 'tracking_stopped'))");
    expect(columns(agencyAlerts).sort()).toEqual(["client_id", "created_at", "dismissed_at", "id", "kind", "owner_id", "period", "resource", "website_id"]);
  });

  it("drops the removed portal's tables, and nothing else", () => {
    const drops = [...sql.matchAll(/DROP TABLE IF EXISTS (\w+)/gi)].map((m) => m[1]);
    expect(drops).toEqual(["agency_portal_tokens", "agency_client_users"]);
  });
});
