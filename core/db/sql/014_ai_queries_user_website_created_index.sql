-- AI query history and per-user daily caps filter by (user_id, website_id)
-- ordered by created_at DESC. This composite index serves both the history list
-- and the daily-count cap lookup without scanning all of a user's queries.
CREATE INDEX IF NOT EXISTS ix_ai_queries_user_website_created
  ON ai_queries (user_id, website_id, created_at DESC);
