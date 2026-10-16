-- Server-side conversions: a site's purchases, leads and sign-ups, forwarded from Seentics'
-- servers to its ad platforms (Meta's Conversions API, Google Analytics 4's Measurement
-- Protocol), where ad blockers and browser limits cannot drop them.
--
--   conversion_destinations  one per connected pixel or GA4 stream: sealed credentials (the
--                            integrations vault, bound to website and id), which events go
--                            and under what name, and the destination's health.
--   conversion_events        the outbox: one row per conversion per destination, claimed by
--                            the worker under a lease and retried on a back-off. The payload
--                            holds only what the platform matches by — hashed email and phone,
--                            click and pixel ids, IP and browser — and is cleared once the
--                            event is delivered or given up on. Rows are kept 30 days for the
--                            delivery log, then deleted.
--
-- Only consented visitors' events are ever queued: an anonymous batch is not routed here, and
-- a popup lead is queued only when its consent box was ticked.

CREATE TABLE IF NOT EXISTS conversion_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  platform VARCHAR(16) NOT NULL CHECK (platform IN ('meta', 'ga4')),
  name VARCHAR(80) NOT NULL DEFAULT '',
  -- The pixel id or measurement id: what makes two destinations the same one.
  account_ref VARCHAR(64) NOT NULL,
  credentials TEXT NOT NULL,
  credentials_hint VARCHAR(120) NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(8) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversion_destinations_account
  ON conversion_destinations (website_id, platform, account_ref);

CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES conversion_destinations(id) ON DELETE CASCADE,
  website_id UUID NOT NULL,
  -- Deduplication: the order id for a purchase, else an id stable across retries of the batch.
  event_id VARCHAR(200) NOT NULL,
  kind VARCHAR(8) NOT NULL CHECK (kind IN ('purchase', 'lead', 'sign_up', 'custom')),
  event_name VARCHAR(120) NOT NULL,
  platform_event VARCHAR(120) NOT NULL,
  -- The visitor the event came from, so a visitor's erasure finds what is still queued.
  visitor_id TEXT,
  value NUMERIC(14, 2),
  currency CHAR(3),
  order_id VARCHAR(200),
  match_keys TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB,
  status VARCHAR(8) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  http_status INTEGER,
  error TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversion_events_destination_event
  ON conversion_events (destination_id, event_id);
CREATE INDEX IF NOT EXISTS ix_conversion_events_due
  ON conversion_events (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_conversion_events_website_created
  ON conversion_events (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_conversion_events_visitor
  ON conversion_events (website_id, visitor_id) WHERE visitor_id IS NOT NULL;
