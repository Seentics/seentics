-- Replace the under-specified replay indexes with a compound index that
-- covers the actual query patterns used by the application.

-- Drop the old single-column index — every query also filters by website_id,
-- so an index starting with session_id alone is never optimal.
DROP INDEX IF EXISTS idx_session_replays_session_id_seq;

-- Compound index for chunk lookups and sequence ordering.
-- Covers: WHERE website_id = $1 AND session_id = $2 ORDER BY sequence ASC
CREATE INDEX IF NOT EXISTS idx_session_replays_ws_session_seq
    ON session_replays (website_id, session_id, sequence ASC);

-- Index for the ListSessions GROUP BY + ORDER BY query.
-- Covers: WHERE website_id = $1 GROUP BY session_id ORDER BY MIN(timestamp) DESC
CREATE INDEX IF NOT EXISTS idx_session_replays_ws_timestamp
    ON session_replays (website_id, timestamp DESC);

-- Index for the FindSessionIDForPage query (heatmap page snapshot lookup).
-- Covers: WHERE website_id = $1 AND entry_page = $2 AND sequence = 0
CREATE INDEX IF NOT EXISTS idx_session_replays_ws_entrypage
    ON session_replays (website_id, entry_page, sequence)
    WHERE entry_page IS NOT NULL AND entry_page != '';

-- Index for the CountSessionsForUser JOIN query (global billing quota).
-- Covers: JOIN websites w ON sr.website_id = w.site_id WHERE w.user_id = $1
-- The websites.site_id index already exists; this ensures the join side is fast.
-- (idx_websites_site_id is already created in 0003_websites.up.sql)
