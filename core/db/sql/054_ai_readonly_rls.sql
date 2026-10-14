-- Tenant isolation for AI-generated SQL, enforced by Postgres rather than by text checks.
--
-- AI SQL runs as seentics_ai_readonly (044) inside a transaction where runGuarded
-- (modules/ai/repositories/postgres-ai.repository.ts) first sets
--
--     set_config('app.ai_website_id', <website id>, true)   -- transaction-local
--
-- and then SET LOCAL ROLE seentics_ai_readonly. Until this migration, that role could
-- SELECT every tenant's rows in its six tables, and validateAndSanitizeSQL was the only
-- tenant boundary — a text check that was bypassed several ways (SQL inside string
-- literals run through query_to_xml, `website_id = $1 IS FALSE`, a self-join with one
-- side filtered, ...). After it, the role sees only the website named in that setting;
-- with the setting missing or empty it sees nothing (NULL never equals anything).
--
-- Two mechanisms, because one table cannot take the first:
--
-- 1. Row-level security on funnels, heatmap_points, automations, automation_events and
--    session_replays. ENABLE only, never FORCE: the table owner (the login that ran the
--    migrations / drizzle push, which is the application's own login) bypasses RLS
--    without FORCE, and superusers always do. In case the application ever connects as a
--    role that is NOT the owner, every table also gets a permissive `ai_passthrough`
--    policy that admits every role except seentics_ai_readonly — permissive policies are
--    OR-ed, so for that one role only `ai_tenant_read` can admit a row, and for everyone
--    else nothing changes.
--
-- 2. analytics_events through a filtered view. On TimescaleDB, analytics_events is a
--    hypertable with compression (037/038) and TimescaleDB refuses
--    `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on it ("operation not supported on
--    hypertables that have columnstore enabled", verified on 2.30). Its chunks also
--    inherit the hypertable's grants, so the role could read them directly. So the role
--    loses SELECT on the table itself (TimescaleDB propagates the REVOKE to every chunk),
--    and gets a security-barrier view of the same name in schema `ai_tenant` instead.
--    runGuarded puts `ai_tenant` first on the search_path, so `FROM analytics_events` in
--    model SQL resolves to the view. The view runs with its owner's rights, so it can read
--    the base table the role no longer can. The same view is used on a plain (007,
--    partitioned) Postgres too, so there is one mechanism for this table everywhere.
--
--    The view's column list is fixed when it is created. A column added to
--    analytics_events later is invisible to AI SQL until this view is re-created (in a new
--    migration: DROP VIEW + CREATE VIEW). If 037 converts the table to a hypertable after
--    this ran (TimescaleDB installed later), its DROP ... CASCADE removes the view and the
--    role has no grant on the new table: AI queries on analytics_events then fail closed
--    with "permission denied" until the view is re-created.
--
-- Note what this does not stop: SQL that runs as this role and calls set_config() can
-- change app.ai_website_id. validateAndSanitizeSQL rejects set_config / current_setting
-- anywhere in the statement, including inside string literals, and rejects the
-- query_to_xml family that would execute such a literal.
--
-- Idempotent: policies are dropped and re-created, the view is CREATE OR REPLACE.

-- ---------------------------------------------------------------------------------------
-- 1. Row-level security
-- ---------------------------------------------------------------------------------------

-- uuid website_id columns.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['funnels', 'heatmap_points', 'automations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_tenant_read ON %I', t);
    EXECUTE format(
      'CREATE POLICY ai_tenant_read ON %I AS PERMISSIVE FOR SELECT TO seentics_ai_readonly '
      'USING (website_id = nullif(current_setting(''app.ai_website_id'', true), '''')::uuid)', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_passthrough ON %I', t);
    EXECUTE format(
      'CREATE POLICY ai_passthrough ON %I AS PERMISSIVE FOR ALL TO PUBLIC '
      'USING (current_user <> ''seentics_ai_readonly'') '
      'WITH CHECK (current_user <> ''seentics_ai_readonly'')', t);
  END LOOP;
END
$$;

-- session_replays.website_id is text (see db/schema.ts).
ALTER TABLE session_replays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_tenant_read ON session_replays;
CREATE POLICY ai_tenant_read ON session_replays AS PERMISSIVE FOR SELECT TO seentics_ai_readonly
  USING (website_id = nullif(current_setting('app.ai_website_id', true), ''));
DROP POLICY IF EXISTS ai_passthrough ON session_replays;
CREATE POLICY ai_passthrough ON session_replays AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_user <> 'seentics_ai_readonly')
  WITH CHECK (current_user <> 'seentics_ai_readonly');

-- automation_events has no website_id; tenancy is through its automation. The subquery on
-- automations is itself filtered by automations' policy for this role.
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_tenant_read ON automation_events;
CREATE POLICY ai_tenant_read ON automation_events AS PERMISSIVE FOR SELECT TO seentics_ai_readonly
  USING (EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = automation_events.automation_id
      AND a.website_id = nullif(current_setting('app.ai_website_id', true), '')::uuid
  ));
DROP POLICY IF EXISTS ai_passthrough ON automation_events;
CREATE POLICY ai_passthrough ON automation_events AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_user <> 'seentics_ai_readonly')
  WITH CHECK (current_user <> 'seentics_ai_readonly');

-- ---------------------------------------------------------------------------------------
-- 2. analytics_events (text website_id) through a tenant-filtered view
-- ---------------------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS ai_tenant;
REVOKE ALL ON SCHEMA ai_tenant FROM PUBLIC;
GRANT USAGE ON SCHEMA ai_tenant TO seentics_ai_readonly;

-- security_barrier: the view's tenant filter is applied before any non-leakproof
-- condition from the outer query, so an error message or function cannot observe a row
-- of another tenant.
CREATE OR REPLACE VIEW ai_tenant.analytics_events WITH (security_barrier = true) AS
  SELECT * FROM public.analytics_events
  WHERE website_id = nullif(current_setting('app.ai_website_id', true), '');

REVOKE ALL ON ai_tenant.analytics_events FROM PUBLIC;
GRANT SELECT ON ai_tenant.analytics_events TO seentics_ai_readonly;
REVOKE ALL ON public.analytics_events FROM seentics_ai_readonly;
