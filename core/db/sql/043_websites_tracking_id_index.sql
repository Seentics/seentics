-- The tracker sends either websites.id or websites.tracking_id; the gateway resolves the
-- owner of every batch by it. Without an index on tracking_id each lookup scanned the table.
CREATE INDEX IF NOT EXISTS ix_websites_tracking_id ON websites (tracking_id);
