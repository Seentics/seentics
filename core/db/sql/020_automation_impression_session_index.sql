-- Index the session half of the frequency-cap lookup.
--
-- `getImpressionStats` runs on `/tracker/automations/evaluate` — anonymous, tracker-facing,
-- fired on every behavioural trigger from every visitor — and asks:
--
--   WHERE automation_id IN (…) AND (anonymous_id = $1 OR session_id = $2)
--
-- `ix_auto_imp_auto_anon` covers the first side of that OR. Nothing covered the second, so
-- Postgres could only use the index for `automation_id` and then filter: it read *every
-- impression ever recorded* for those automations and threw almost all of it away.
--
-- Measured on 300k impressions across 10 automations: 10.8ms reading 90,000 index entries,
-- against 0.118ms reading 10 once both sides are indexable and the planner can BitmapOr
-- them. Ninety times faster, but the ratio is not the point — the old plan's cost is
-- proportional to how many impressions an automation has *accumulated*, and this table only
-- grows until retention prunes it. A popular automation gets slower every day it runs.
--
-- Idempotent, like every file in this directory.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_auto_imp_auto_session
  ON automation_impressions (automation_id, session_id);
