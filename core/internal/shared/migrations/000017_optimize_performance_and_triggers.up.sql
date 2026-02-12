-- 1. Create function for automatic updated_at updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Apply triggers to core tables
-- websites
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_websites_updated_at') THEN
        CREATE TRIGGER trg_update_websites_updated_at 
        BEFORE UPDATE ON websites FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- users
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_users_updated_at') THEN
        CREATE TRIGGER trg_update_users_updated_at 
        BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- goals
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_goals_updated_at') THEN
        CREATE TRIGGER trg_update_goals_updated_at 
        BEFORE UPDATE ON goals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- automations
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_automations_updated_at') THEN
        CREATE TRIGGER trg_update_automations_updated_at 
        BEFORE UPDATE ON automations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- funnels
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_funnels_updated_at') THEN
        CREATE TRIGGER trg_update_funnels_updated_at 
        BEFORE UPDATE ON funnels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- 3. High-performance composite index for main dashboard queries
-- This covers filtering by website, event_type (usually 'pageview'), and timestamp range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_dashboard_perf 
ON events (website_id, event_type, timestamp DESC);

-- 4. BRIN Index for very large data (Time-series optimization)
-- BRIN indexes are 100x smaller than B-Tree and excel at time-sorted data scans
-- Note: CONCURRENTLY is not supported for BRIN
CREATE INDEX IF NOT EXISTS idx_events_timestamp_brin 
ON events USING BRIN (timestamp);
