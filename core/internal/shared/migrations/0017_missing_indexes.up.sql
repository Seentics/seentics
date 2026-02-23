-- Heatmap indexes for time-range and page grouping queries
CREATE INDEX IF NOT EXISTS idx_heatmap_points_last_updated
    ON heatmap_points (website_id, last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_heatmap_points_page_stats
    ON heatmap_points (website_id, page_path);

CREATE INDEX IF NOT EXISTS idx_heatmap_points_selector
    ON heatmap_points (website_id, page_path, target_selector)
    WHERE target_selector IS NOT NULL AND target_selector != '';

-- Replay indexes for session lookup and entry page queries
CREATE INDEX IF NOT EXISTS idx_session_replays_meta
    ON session_replays (website_id, session_id, sequence)
    WHERE sequence = 0;

CREATE INDEX IF NOT EXISTS idx_session_replays_entry_page
    ON session_replays (website_id, entry_page, timestamp DESC)
    WHERE sequence = 0;

-- Automation execution indexes for frequency control
CREATE INDEX IF NOT EXISTS idx_automation_executions_session
    ON automation_executions (automation_id, session_id);

CREATE INDEX IF NOT EXISTS idx_automation_executions_visitor
    ON automation_executions (automation_id, visitor_id);

CREATE INDEX IF NOT EXISTS idx_automation_executions_visitor_date
    ON automation_executions (automation_id, visitor_id, executed_at DESC);

-- Automation execution stats (covers the aggregation query)
CREATE INDEX IF NOT EXISTS idx_automation_executions_stats
    ON automation_executions (automation_id, status, executed_at);
