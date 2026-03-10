-- Heatmap time-range indexes: covers GetHeatmapData and GetTopElements with last_updated filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_heatmap_time_range
ON heatmap_points (website_id, page_path, event_type, device_type, last_updated);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_heatmap_top_elements
ON heatmap_points (website_id, page_path, event_type, last_updated)
WHERE target_selector != '';

-- Replay rage-click worker index: covers GetUnprocessedSessions query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_replays_rage_unprocessed
ON session_replays (rage_clicks_processed, timestamp ASC)
WHERE sequence = 0 AND rage_clicks_processed = FALSE;
