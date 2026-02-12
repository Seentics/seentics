-- Increase field lengths to accommodate UUIDs (36 chars) and avoid "value too long" errors
-- Most fields are currently VARCHAR(24)

-- Table: websites
ALTER TABLE websites ALTER COLUMN site_id TYPE VARCHAR(64);

-- Table: events
ALTER TABLE events ALTER COLUMN website_id TYPE VARCHAR(64);

-- Table: custom_events_aggregated
ALTER TABLE custom_events_aggregated ALTER COLUMN website_id TYPE VARCHAR(64);

-- Table: privacy_requests
ALTER TABLE privacy_requests ALTER COLUMN website_id TYPE VARCHAR(64);

-- Table: automations
ALTER TABLE automations ALTER COLUMN website_id TYPE VARCHAR(64);

-- Table: automation_executions
ALTER TABLE automation_executions ALTER COLUMN website_id TYPE VARCHAR(64);

-- Table: funnels
ALTER TABLE funnels ALTER COLUMN website_id TYPE VARCHAR(64);
