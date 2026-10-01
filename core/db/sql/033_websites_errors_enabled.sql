-- A switch for error tracking, like the ones replay, heatmaps, funnels and automations
-- have. Off, the tracker reports no uncaught errors and ingest stores none. On by
-- default: every existing site keeps reporting as it does today.

ALTER TABLE websites ADD COLUMN IF NOT EXISTS errors_enabled BOOLEAN NOT NULL DEFAULT true;
