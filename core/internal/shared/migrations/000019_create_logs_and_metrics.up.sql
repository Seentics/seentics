-- Create server_logs table
CREATE TABLE IF NOT EXISTS server_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL, -- INFO, WARN, ERROR, DEBUG
    message TEXT NOT NULL,
    source TEXT NOT NULL, -- backend, frontend, worker, etc.
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create server_metrics table
CREATE TABLE IF NOT EXISTS server_metrics (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    name TEXT NOT NULL, -- cpu_usage, memory_usage, request_count, etc.
    value DOUBLE PRECISION NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}' -- e.g. {"service": "api", "host": "prod-1"}
);

-- Add indexes for performance
CREATE INDEX idx_server_logs_timestamp ON server_logs(timestamp DESC);
CREATE INDEX idx_server_logs_level ON server_logs(level);
CREATE INDEX idx_server_logs_source ON server_logs(source);

CREATE INDEX idx_server_metrics_timestamp ON server_metrics(timestamp DESC);
CREATE INDEX idx_server_metrics_name ON server_metrics(name);
