-- Automation engine tables: impressions, user profiles, webhook log, identity aliases.
-- All statements use IF NOT EXISTS / DO UPDATE so reruns are safe.

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS priority   integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS status     text    NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS automation_impressions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid        NOT NULL,
  anonymous_id  text        NOT NULL,
  user_id       text,
  website_id    uuid        NOT NULL,
  session_id    text        NOT NULL,
  shown_at      timestamptz NOT NULL DEFAULT NOW(),
  action_taken  text,
  variant       text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_auto_imp_auto_anon   ON automation_impressions (automation_id, anonymous_id);
CREATE INDEX IF NOT EXISTS ix_auto_imp_website     ON automation_impressions (website_id, shown_at);
CREATE INDEX IF NOT EXISTS ix_auto_imp_session     ON automation_impressions (session_id);

CREATE TABLE IF NOT EXISTS user_profiles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      uuid        NOT NULL,
  anonymous_id    text        NOT NULL,
  user_id         text,
  properties      jsonb       NOT NULL DEFAULT '{}',
  computed        jsonb       NOT NULL DEFAULT '{}',
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  visit_count     integer     NOT NULL DEFAULT 1,
  total_page_views integer    NOT NULL DEFAULT 0,
  country         text,
  city            text,
  device          text,
  browser         text,
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (website_id, anonymous_id)
);
CREATE INDEX IF NOT EXISTS ix_user_profiles_website_anon ON user_profiles (website_id, anonymous_id);
CREATE INDEX IF NOT EXISTS ix_user_profiles_website_user ON user_profiles (website_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   uuid        NOT NULL,
  run_id          uuid,
  url             text        NOT NULL,
  status_code     integer,
  success         boolean,
  attempt_count   integer     NOT NULL DEFAULT 1,
  last_attempt_at timestamptz,
  response_ms     integer,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_webhook_deliveries_auto ON webhook_deliveries (automation_id, created_at);

CREATE TABLE IF NOT EXISTS identity_aliases (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id text        NOT NULL,
  user_id      text        NOT NULL,
  website_id   uuid        NOT NULL,
  linked_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (anonymous_id, website_id)
);
CREATE INDEX IF NOT EXISTS ix_identity_aliases_anon ON identity_aliases (anonymous_id, website_id);
