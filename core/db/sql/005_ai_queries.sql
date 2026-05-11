-- Migration 005: AI queries table
-- Stores each user prompt → generated SQL → result metadata for the Seentics AI feature.

CREATE TABLE IF NOT EXISTS ai_queries (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID          NOT NULL,
  website_id         TEXT          NOT NULL,
  prompt             TEXT          NOT NULL,
  system_context     TEXT,
  generated_sql      TEXT,
  viz_type           VARCHAR(32),
  title              TEXT,
  insight            TEXT,
  x_key              TEXT,
  y_key              TEXT,
  columns            JSONB,
  row_count          INTEGER,
  model              VARCHAR(64)   NOT NULL DEFAULT 'gpt-4o-mini',
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  estimated_cost_usd REAL,
  status             VARCHAR(32)   NOT NULL DEFAULT 'pending',
  error_message      TEXT,
  execution_time_ms  INTEGER,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ai_queries_user_id      ON ai_queries (user_id);
CREATE INDEX IF NOT EXISTS ix_ai_queries_website_id   ON ai_queries (website_id);
CREATE INDEX IF NOT EXISTS ix_ai_queries_user_created ON ai_queries (user_id, created_at);
