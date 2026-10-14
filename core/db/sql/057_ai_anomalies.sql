-- Anomaly alerts: what the hourly check found wrong with a site, and each site's alert settings
-- (modules/ai/anomalies).
--
-- `ai_anomalies` holds one row per incident. Detection is deterministic — a window's pageviews,
-- visitors, errors or goal completions against the same window of the four previous weeks — and
-- a model only adds one sentence of likely cause. An incident is opened once and updated while it
-- lasts: the partial unique index lets each (site, type, subject) have at most one open row, so an
-- ongoing drop alerts once however many hourly checks see it. It closes with a resolution:
-- `recovered` (back to normal, which may be mailed), `expired` (not seen for two days) or
-- `disabled` (alerts turned off).
--
-- `subject` says what within the site: '' for site-wide traffic and tracking, an error group's
-- fingerprint, a goal's id. `facts` keeps the baseline values and labels the wording came from.
-- Counts and plain-language sentences only, never visitor data; error messages are masked before
-- they are stored.
--
-- `notified_at` / `notify_status` record the email: sent, or why not (rate_limited, below the
-- severity that mails, flapping, no gateway). Deleted with the website, and by the AI retention
-- sweep once old.

CREATE TABLE IF NOT EXISTS ai_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  -- traffic_drop | traffic_spike | tracking_outage | error_surge | conversion_drop
  type VARCHAR(32) NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  -- open | resolved
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  -- low | medium | high | critical
  severity VARCHAR(10) NOT NULL,
  -- pageviews | visitors | errors | conversions
  metric VARCHAR(20) NOT NULL,
  observed DOUBLE PRECISION NOT NULL DEFAULT 0,
  expected DOUBLE PRECISION NOT NULL DEFAULT 0,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  explanation TEXT,
  -- ai | rules
  explanation_source VARCHAR(8),
  -- Dashboard path suffix under /websites/:id/ ('' | errors | goals | settings/tracking).
  path VARCHAR(100) NOT NULL DEFAULT '',
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  -- recovered | expired | disabled
  resolution VARCHAR(12),
  notified_at TIMESTAMPTZ,
  notify_status VARCHAR(20),
  resolved_notified_at TIMESTAMPTZ,
  model VARCHAR(100),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0
);

-- The dedupe: one open incident per site, type and subject.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_anomalies_open
  ON ai_anomalies (website_id, type, subject) WHERE status = 'open';
-- The dashboard list, the per-site email count and the flapping check: one site, newest first.
CREATE INDEX IF NOT EXISTS ix_ai_anomalies_website_detected
  ON ai_anomalies (website_id, detected_at DESC);

-- Per-site alert settings. No row: enabled, normal sensitivity. Changed by owners and admins.
CREATE TABLE IF NOT EXISTS ai_anomaly_settings (
  website_id UUID PRIMARY KEY REFERENCES websites(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- low | normal | high
  sensitivity VARCHAR(10) NOT NULL DEFAULT 'normal',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
