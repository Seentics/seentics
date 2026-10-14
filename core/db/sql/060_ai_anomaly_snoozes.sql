-- Anomaly alert snoozes (modules/ai/anomalies): "stop telling me about this until …".
--
-- One row per site and scope. `type` is an anomaly type or '*' for every type; `subject` is
-- what within the site ('' for site-wide traffic, an error fingerprint, a goal id) or '*' for
-- every subject of the type. Snoozing one anomaly snoozes its (type, subject), so the same
-- incident reopening inside the window stays quiet too.
--
-- While a snooze holds, the hourly check still detects and stores anomalies — the dashboard's
-- full list keeps them — but does not mail them, and the dashboard banner hides them. Created
-- by owners and admins, through the assistant (a confirmed draft). A later snooze of the same
-- scope replaces the earlier one. Expired rows are deleted by the hourly run, and every row goes
-- with its website.

CREATE TABLE IF NOT EXISTS ai_anomaly_snoozes (
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  subject TEXT NOT NULL,
  until TIMESTAMPTZ NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (website_id, type, subject)
);

-- The hourly purge of expired snoozes.
CREATE INDEX IF NOT EXISTS ix_ai_anomaly_snoozes_until ON ai_anomaly_snoozes (until);
