-- Consolidated baseline (pre-production squash). Analytics events live in ClickHouse; PostgreSQL holds app state, heatmaps, replays, etc.

-- ── Users & auth ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    reset_token TEXT,
    reset_token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- ── Websites & goals ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(64) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    tracking_id VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(100),
    automation_enabled BOOLEAN NOT NULL DEFAULT true,
    funnel_enabled BOOLEAN NOT NULL DEFAULT true,
    heatmap_enabled BOOLEAN NOT NULL DEFAULT true,
    heatmap_include_patterns TEXT,
    heatmap_exclude_patterns TEXT,
    replay_enabled BOOLEAN DEFAULT true,
    replay_sampling_rate DOUBLE PRECISION DEFAULT 1.0,
    replay_include_patterns TEXT,
    replay_exclude_patterns TEXT,
    public_share_id VARCHAR(32) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS website_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(website_id, user_id)
);

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    selector VARCHAR(255),
    revenue DOUBLE PRECISION,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_websites_user_id ON websites(user_id);
CREATE INDEX idx_websites_site_id ON websites(site_id);
CREATE INDEX idx_websites_public_share_id ON websites(public_share_id) WHERE public_share_id IS NOT NULL;
CREATE INDEX idx_website_members_website_id ON website_members(website_id);
CREATE INDEX idx_website_members_user_id ON website_members(user_id);
CREATE INDEX idx_goals_website_id ON goals(website_id);

-- ── Analytics aggregates & privacy (events table removed — use ClickHouse) ─
CREATE TABLE IF NOT EXISTS custom_events_aggregated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_signature VARCHAR(64) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    sample_properties JSONB,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_events_website_signature ON custom_events_aggregated (website_id, event_signature, last_seen);
CREATE INDEX IF NOT EXISTS idx_custom_events_type
    ON custom_events_aggregated(website_id, event_type, last_seen DESC);

CREATE TABLE IF NOT EXISTS privacy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    data JSONB
);

CREATE INDEX idx_privacy_requests_website_id ON privacy_requests(website_id);

CREATE TABLE IF NOT EXISTS privacy_audit_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation  VARCHAR(100) NOT NULL,
    user_id    TEXT NOT NULL,
    details    TEXT,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX idx_privacy_audit_log_user_id   ON privacy_audit_log(user_id);
CREATE INDEX idx_privacy_audit_log_timestamp ON privacy_audit_log(timestamp DESC);
CREATE INDEX idx_privacy_audit_log_operation ON privacy_audit_log(operation);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    visitor_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_website_start ON sessions(website_id, start_time);

-- ── Automations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    condition_type VARCHAR(100) NOT NULL,
    condition_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    website_id VARCHAR(64) NOT NULL,
    visitor_id VARCHAR(255),
    session_id VARCHAR(255),
    trigger_event_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    execution_data JSONB,
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_automations_website_id ON automations(website_id);
CREATE INDEX idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_session
    ON automation_executions (automation_id, session_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_visitor
    ON automation_executions (automation_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_visitor_date
    ON automation_executions (automation_id, visitor_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_executions_stats
    ON automation_executions (automation_id, status, executed_at);

-- ── Funnels ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funnel_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    page_path VARCHAR(500),
    event_type VARCHAR(255),
    match_type VARCHAR(50) DEFAULT 'exact',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funnel_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    step_order INTEGER NOT NULL,
    entries INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    dropoffs INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    avg_time_to_complete INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(funnel_id, date, step_order)
);

CREATE INDEX idx_funnels_website_id ON funnels(website_id);
CREATE INDEX idx_funnel_steps_funnel_id ON funnel_steps(funnel_id);

-- ── Heatmaps & session replays ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heatmap_points (
    website_id UUID NOT NULL,
    page_path TEXT NOT NULL,
    event_type VARCHAR(10) NOT NULL,
    device_type VARCHAR(20) NOT NULL,
    x_percent INTEGER NOT NULL,
    y_percent INTEGER NOT NULL,
    intensity INT DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    target_selector TEXT NOT NULL DEFAULT '',
    el_x SMALLINT NOT NULL DEFAULT -1,
    el_y SMALLINT NOT NULL DEFAULT -1,
    doc_height INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector)
);

CREATE TABLE IF NOT EXISTS heatmap_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    page_path TEXT NOT NULL,
    screen_width INT NOT NULL,
    screen_height INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    sequence INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    browser    VARCHAR(100),
    device     VARCHAR(50),
    os         VARCHAR(100),
    country    VARCHAR(100),
    entry_page TEXT,
    has_rage_clicks        BOOLEAN NOT NULL DEFAULT FALSE,
    rage_clicks_processed   BOOLEAN NOT NULL DEFAULT FALSE,
    duration_seconds INT NOT NULL DEFAULT 0,
    pages_viewed     INT NOT NULL DEFAULT 1,
    CONSTRAINT uq_session_replay_chunk UNIQUE (website_id, session_id, sequence)
);

CREATE INDEX idx_heatmap_lookup ON heatmap_points (website_id, page_path, event_type, device_type);
CREATE INDEX IF NOT EXISTS idx_heatmap_points_last_updated
    ON heatmap_points (website_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_heatmap_points_page_stats
    ON heatmap_points (website_id, page_path);
CREATE INDEX IF NOT EXISTS idx_heatmap_points_selector
    ON heatmap_points (website_id, page_path, target_selector)
    WHERE target_selector IS NOT NULL AND target_selector != '';
CREATE INDEX IF NOT EXISTS idx_heatmap_time_range
    ON heatmap_points (website_id, page_path, event_type, device_type, last_updated);
CREATE INDEX IF NOT EXISTS idx_heatmap_top_elements
    ON heatmap_points (website_id, page_path, event_type, last_updated)
    WHERE target_selector != '';

CREATE INDEX IF NOT EXISTS idx_session_replays_ws_session_seq
    ON session_replays (website_id, session_id, sequence ASC);
CREATE INDEX IF NOT EXISTS idx_session_replays_ws_timestamp
    ON session_replays (website_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_session_replays_ws_entrypage
    ON session_replays (website_id, entry_page, sequence)
    WHERE entry_page IS NOT NULL AND entry_page != '';
CREATE INDEX IF NOT EXISTS idx_session_replays_meta
    ON session_replays (website_id, session_id, sequence)
    WHERE sequence = 0;
CREATE INDEX IF NOT EXISTS idx_session_replays_entry_page
    ON session_replays (website_id, entry_page, timestamp DESC)
    WHERE sequence = 0;
CREATE INDEX IF NOT EXISTS idx_session_replay_unprocessed_rc
    ON session_replays (timestamp)
    WHERE sequence = 0 AND rage_clicks_processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_session_replays_rage_unprocessed
    ON session_replays (rage_clicks_processed, timestamp ASC)
    WHERE sequence = 0 AND rage_clicks_processed = FALSE;
CREATE INDEX idx_session_replays_website_id ON session_replays(website_id);

-- ── Invitations & API keys ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS website_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(website_id, email)
);

CREATE INDEX idx_website_invitations_token ON website_invitations(token);
CREATE INDEX idx_website_invitations_website_id ON website_invitations(website_id);
CREATE INDEX idx_website_invitations_email ON website_invitations(email);

CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id   VARCHAR(64)  NOT NULL,
    user_id      VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    key_hash     VARCHAR(64)  NOT NULL UNIQUE,
    key_prefix   VARCHAR(16)  NOT NULL,
    scopes       TEXT[]       NOT NULL DEFAULT '{"read"}',
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_website_id ON api_keys(website_id);
CREATE INDEX idx_api_keys_key_hash   ON api_keys(key_hash);

-- ── Timestamps: updated_at triggers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_websites_updated_at ON websites;
CREATE TRIGGER trg_update_websites_updated_at BEFORE UPDATE ON websites FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_users_updated_at ON users;
CREATE TRIGGER trg_update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_goals_updated_at ON goals;
CREATE TRIGGER trg_update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_automations_updated_at ON automations;
CREATE TRIGGER trg_update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_funnels_updated_at ON funnels;
CREATE TRIGGER trg_update_funnels_updated_at BEFORE UPDATE ON funnels FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
