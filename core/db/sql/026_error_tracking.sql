-- Frontend error tracking.
--
-- The tracker has caught `window.onerror` and `unhandledrejection` since automations
-- shipped, but only to fire a trigger: the error itself was truncated to 200 characters,
-- capped at three per page, and discarded. These two tables keep it.
--
-- Split into groups and samples on purpose. Grouping occurrences by fingerprint at read
-- time would be a full scan for a figure that changes one row at a time — the same shape
-- as the analytics reads that make this dashboard slow — and the group list is read far
-- more often than it is written. The split also lets the two ages differ: samples are
-- purged on the retention cron, counts are not, so "first seen in March, 12k times"
-- stays true long after the last sample expires.

CREATE TABLE IF NOT EXISTS error_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      uuid NOT NULL,
  -- sha256 of the normalised message and source. Computed server-side so the rule can
  -- change without waiting for cached tracker bundles, and so a page cannot pick its own.
  fingerprint     varchar(64) NOT NULL,
  kind            varchar(32) NOT NULL DEFAULT 'error',
  message         text NOT NULL,
  source_file     text NOT NULL DEFAULT '',
  line_no         integer,
  col_no          integer,
  status          varchar(16) NOT NULL DEFAULT 'unresolved',
  event_count     integer NOT NULL DEFAULT 0,
  last_page_path  text NOT NULL DEFAULT '',
  first_seen      timestamptz NOT NULL DEFAULT now(),
  last_seen       timestamptz NOT NULL DEFAULT now()
);

-- The upsert target: ingest raises counts through this, so it has to be unique.
CREATE UNIQUE INDEX IF NOT EXISTS error_groups_fingerprint_uq
  ON error_groups (website_id, fingerprint);

-- The list query: one site's open faults, newest first.
CREATE INDEX IF NOT EXISTS ix_error_groups_website_status_seen
  ON error_groups (website_id, status, last_seen DESC);

CREATE TABLE IF NOT EXISTS error_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL,
  fingerprint   varchar(64) NOT NULL,
  message       text NOT NULL,
  stack         text NOT NULL DEFAULT '',
  source_file   text NOT NULL DEFAULT '',
  line_no       integer,
  col_no        integer,
  page_path     text NOT NULL DEFAULT '',
  -- The join to session replay, and the reason this is worth building here rather than
  -- buying: the error and the recording of the visitor hitting it are the same row's
  -- neighbours. A standalone error tracker has to bolt that on.
  session_id    text,
  visitor_id    text,
  browser       text NOT NULL DEFAULT '',
  os            text NOT NULL DEFAULT '',
  device_type   text NOT NULL DEFAULT '',
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

-- Retention purge scans by site and age.
CREATE INDEX IF NOT EXISTS ix_error_events_website_occurred
  ON error_events (website_id, occurred_at);

-- The detail view: recent samples for one group.
CREATE INDEX IF NOT EXISTS ix_error_events_group_occurred
  ON error_events (website_id, fingerprint, occurred_at DESC);
