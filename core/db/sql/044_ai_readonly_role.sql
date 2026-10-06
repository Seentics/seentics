-- The role AI-generated SQL runs as (modules/ai/repositories/postgres-ai.repository.ts).
--
-- The statement guard is a text check and is not a security boundary on its own: whatever it
-- misses would otherwise run with the application's own rights, which include the users table
-- and every other tenant's data. This role can read only the tables the AI domains are allowed
-- to query, and write nothing, so a statement that slips past the guard still cannot reach
-- credentials, billing or any other table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'seentics_ai_readonly') THEN
    CREATE ROLE seentics_ai_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO seentics_ai_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM seentics_ai_readonly;
GRANT SELECT ON analytics_events, funnels, heatmap_points, automations, automation_events, session_replays
  TO seentics_ai_readonly;

-- The application's own login must be allowed to SET ROLE to it (a superuser always may).
DO $$
BEGIN
  EXECUTE format('GRANT seentics_ai_readonly TO %I', current_user);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'could not grant seentics_ai_readonly to %: %', current_user, SQLERRM;
END
$$;
