-- Create automations table
CREATE TABLE automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id VARCHAR(24) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL, -- 'event', 'page_visit', 'time_based', 'utm_campaign'
    trigger_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create automation_actions table (one automation can have multiple actions)
CREATE TABLE automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL, -- 'email', 'webhook', 'slack', 'discord', 'custom'
    action_config JSONB NOT NULL DEFAULT '{}',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create automation_conditions table (optional conditions for actions)
CREATE TABLE automation_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    condition_type VARCHAR(100) NOT NULL, -- 'visitor_count', 'time_range', 'device_type', 'country', 'custom'
    condition_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create automation_executions table (track execution history)
CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    website_id VARCHAR(24) NOT NULL,
    visitor_id VARCHAR(255),
    session_id VARCHAR(255),
    trigger_event_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'partial'
    execution_data JSONB,
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX idx_automations_website_id ON automations(website_id);
CREATE INDEX idx_automations_is_active ON automations(is_active) WHERE is_active = true;
CREATE INDEX idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX idx_automations_created_at ON automations(created_at DESC);

CREATE INDEX idx_automation_actions_automation_id ON automation_actions(automation_id);
CREATE INDEX idx_automation_actions_order ON automation_actions(automation_id, order_index);

CREATE INDEX idx_automation_conditions_automation_id ON automation_conditions(automation_id);

CREATE INDEX idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX idx_automation_executions_website_id ON automation_executions(website_id);
CREATE INDEX idx_automation_executions_executed_at ON automation_executions(executed_at DESC);
CREATE INDEX idx_automation_executions_status ON automation_executions(status);
