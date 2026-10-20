-- An automation's one-line description. The dashboard has always sent one and shown it beside
-- the name, but there was no column, so the schema stripped it and every description read empty.
ALTER TABLE IF EXISTS automations ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
