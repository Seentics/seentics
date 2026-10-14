-- Archived stylesheets for session replays and heatmap snapshots
-- (modules/recordings/services/stylesheets/).
--
-- The tracker records rrweb without inlining stylesheets, so a recording holds only
-- `<link rel="stylesheet" href="https://site/_next/static/css/<hash>.css">`. The player
-- used to load that URL from the live site at replay time, and a hashed CSS file is gone
-- after the site's next deploy: every older recording then replayed as unstyled HTML.
--
-- Ingest (and a one-off backfill) records each stylesheet URL a recording or a heatmap
-- snapshot links to as `pending`; a worker job fetches it once, SSRF-guarded, rewrites its
-- `url(...)` and `@import` targets to absolute URLs, and stores the copy in the replays
-- bucket under `stylesheets/<website_id>/<content sha256>.css`. The player is pointed at
-- the archived copy, falling back to the original URL while there is none.
--
-- `website_id` is text, like `session_replays.website_id`. Rows go with the site's
-- erasure (app/http/privacy.ts) and age out with retention once no recording or snapshot
-- has referenced them for the retention window (`last_seen_at`).

CREATE TABLE IF NOT EXISTS replay_stylesheets (
  website_id TEXT NOT NULL,
  -- sha256 hex of `url`: the key, so a long URL is never an index entry.
  url_hash CHAR(64) NOT NULL,
  url TEXT NOT NULL,
  -- pending | stored | failed | too_large | not_css
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  -- Object key of the stored copy; shared by every row of the site with the same content.
  storage_key TEXT,
  bytes INTEGER,
  content_sha256 CHAR(64),
  fetched_at TIMESTAMPTZ,
  attempts SMALLINT NOT NULL DEFAULT 0,
  -- When a pending row may next be tried. Also the claim lease: a claimed row is pushed
  -- forward, so a worker that dies mid-fetch hands it back after the lease runs out.
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Last time a recording or snapshot linked to it, refreshed at most daily.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (website_id, url_hash)
);

-- Separately, so it also lands when the schema push created the table before this ran.
DO $$
BEGIN
  ALTER TABLE replay_stylesheets ADD CONSTRAINT ck_replay_stylesheets_status
    CHECK (status IN ('pending', 'stored', 'failed', 'too_large', 'not_css'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The fetch job's claim: due pending rows across all sites, oldest first.
CREATE INDEX IF NOT EXISTS ix_replay_stylesheets_due
  ON replay_stylesheets (next_attempt_at)
  WHERE status = 'pending';

-- Content dedupe on store, and "is this object still referenced" on purge.
CREATE INDEX IF NOT EXISTS ix_replay_stylesheets_content
  ON replay_stylesheets (website_id, content_sha256)
  WHERE content_sha256 IS NOT NULL;

-- Retention: a site's rows nothing has referenced since the cutoff.
CREATE INDEX IF NOT EXISTS ix_replay_stylesheets_site_last_seen
  ON replay_stylesheets (website_id, last_seen_at);

-- The backfill's position: recordings made before this migration were never scanned at
-- ingest, so the job walks them newest first, a few per run, down to `floor_ts`. One row;
-- `completed_at` set once the walk reaches the floor. Seeded here, at deploy time, which is
-- exactly where ingest-time discovery takes over.
CREATE TABLE IF NOT EXISTS replay_stylesheet_backfill (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Keyset position (exclusive): the next session scanned started before this.
  cursor_ts TIMESTAMPTZ NOT NULL,
  cursor_website_id TEXT NOT NULL DEFAULT '',
  cursor_session_id TEXT NOT NULL DEFAULT '',
  -- Oldest session start the walk goes back to.
  floor_ts TIMESTAMPTZ NOT NULL,
  sessions_scanned INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ
);

INSERT INTO replay_stylesheet_backfill (id, cursor_ts, floor_ts)
VALUES (1, NOW(), NOW() - INTERVAL '14 days')
ON CONFLICT (id) DO NOTHING;
