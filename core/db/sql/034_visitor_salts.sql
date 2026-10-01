-- Daily salts for counting visitors who have not consented, without storing anything in
-- their browser. A visitor is identified for one day by a hash of (salt, website, IP,
-- user agent); the salt is random, kept for a day, then deleted — after which no one,
-- us included, can recompute who a hash belonged to. See platform/privacy/visitor-salt.ts.

CREATE TABLE IF NOT EXISTS visitor_salts (
  day DATE PRIMARY KEY,
  salt BYTEA NOT NULL
);
