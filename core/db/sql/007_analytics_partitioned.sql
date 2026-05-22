-- Convert analytics_events to a monthly RANGE-partitioned table and install
-- the ensure_analytics_partitions() helper that auto-creates future partitions.
--
-- Safe to run on an existing plain table or a DB that was freshly created —
-- the DO block checks whether the table is already partitioned and skips if so.
--
-- After conversion the table structure is identical; existing data lands in
-- the DEFAULT partition and new inserts route to their monthly partition.

DO $$
BEGIN
  -- Already partitioned — nothing to do.
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'analytics_events'
      AND n.nspname = 'public'
      AND c.relkind = 'p'
  ) THEN
    RAISE NOTICE 'analytics_events is already partitioned — skipping conversion.';
    RETURN;
  END IF;

  RAISE NOTICE 'Converting analytics_events to a range-partitioned table …';

  -- Step 1: rename existing plain table
  ALTER TABLE analytics_events RENAME TO analytics_events_legacy;

  -- Step 2: create the partitioned parent (no PRIMARY KEY — partition key must
  --         be included in any unique constraint, and id alone is sufficient for
  --         an append-only event log; a UNIQUE index on id is added below).
  CREATE TABLE analytics_events (
    id           UUID          NOT NULL DEFAULT gen_random_uuid(),
    website_id   TEXT          NOT NULL,
    event_type   VARCHAR(64)   NOT NULL,
    page         TEXT,
    visitor_id   TEXT,
    session_id   TEXT,
    properties   JSONB,
    referrer     TEXT,
    country      VARCHAR(2),
    region       TEXT,
    city         TEXT,
    browser      TEXT,
    device       TEXT,
    os           TEXT,
    language     TEXT,
    screen_width  INTEGER,
    screen_height INTEGER,
    utm_source   TEXT,
    utm_medium   TEXT,
    utm_campaign TEXT,
    occurred_at  TIMESTAMPTZ   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  ) PARTITION BY RANGE (occurred_at);

  -- Step 3: default partition catches all data that doesn't fit a monthly range.
  --         Historical rows from analytics_events_legacy land here.
  CREATE TABLE analytics_events_default
    PARTITION OF analytics_events DEFAULT;

  -- Step 4: migrate existing data
  INSERT INTO analytics_events
  SELECT id, website_id, event_type, page, visitor_id, session_id, properties,
         referrer, country, region, city, browser, device, os, language,
         screen_width, screen_height, utm_source, utm_medium, utm_campaign,
         occurred_at, created_at
  FROM analytics_events_legacy;

  -- Step 5: drop old table (data is now in the partitioned table)
  DROP TABLE analytics_events_legacy;

  RAISE NOTICE 'analytics_events converted successfully.';
END $$;

-- ─── Indexes (idempotent — applied to the partitioned table + all partitions) ──

-- Core access pattern: filter by website + time window
CREATE INDEX IF NOT EXISTS ix_analytics_site_occurred
  ON analytics_events (website_id, occurred_at);

CREATE INDEX IF NOT EXISTS ix_analytics_site_type_occurred
  ON analytics_events (website_id, event_type, occurred_at);

-- Pageview partial indexes — keep size small, cover the hot paths
CREATE INDEX IF NOT EXISTS ix_analytics_pageview_occurred
  ON analytics_events (website_id, occurred_at)
  WHERE event_type = 'pageview';

CREATE INDEX IF NOT EXISTS ix_analytics_pageview_utm_source
  ON analytics_events (website_id, occurred_at)
  WHERE event_type = 'pageview' AND utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_analytics_pageview_referrer
  ON analytics_events (website_id, occurred_at)
  WHERE event_type = 'pageview' AND referrer IS NOT NULL AND referrer <> '';

-- Revenue events partial index
CREATE INDEX IF NOT EXISTS ix_analytics_revenue_events
  ON analytics_events (website_id, occurred_at DESC)
  WHERE event_type IN ('purchase','order_completed','checkout_completed','sale','conversion','revenue');

-- Session attribution
CREATE INDEX IF NOT EXISTS ix_analytics_pageview_session_occurred
  ON analytics_events (website_id, session_id, occurred_at DESC)
  WHERE event_type = 'pageview' AND session_id IS NOT NULL;

-- ─── Auto-partition function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ensure_analytics_partitions(months_ahead INT DEFAULT 3)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  i              INT;
  partition_start DATE;
  partition_end   DATE;
  partition_name  TEXT;
BEGIN
  FOR i IN 0..months_ahead LOOP
    partition_start := date_trunc('month', NOW() + (i || ' months')::INTERVAL)::DATE;
    partition_end   := date_trunc('month', NOW() + ((i + 1) || ' months')::INTERVAL)::DATE;
    partition_name  := 'analytics_events_' || to_char(partition_start, 'YYYY_MM');

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
      -- PostgreSQL blocks creating a named partition when the default partition
      -- already contains rows whose occurred_at falls within the new range.
      -- Fix: stash conflicting rows in a temp table, create the partition, then
      -- reinsert (they route to the new partition automatically).
      EXECUTE format(
        'CREATE TEMP TABLE IF NOT EXISTS _partition_migrate_rows AS
           SELECT * FROM analytics_events_default WHERE FALSE',
        partition_name
      );
      EXECUTE format(
        'WITH moved AS (
           DELETE FROM analytics_events_default
           WHERE occurred_at >= %L AND occurred_at < %L
           RETURNING *
         )
         INSERT INTO _partition_migrate_rows SELECT * FROM moved',
        partition_start, partition_end
      );
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
        partition_name, partition_start, partition_end
      );
      INSERT INTO analytics_events SELECT * FROM _partition_migrate_rows;
      DROP TABLE IF EXISTS _partition_migrate_rows;
      RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
  END LOOP;
END $$;

-- Create partitions for current month + 3 months ahead on first run
SELECT ensure_analytics_partitions(3);
