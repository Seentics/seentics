-- Conversation threading and agent output for the AI assistant.
--
-- `ai_queries` already recorded one row per question with its model, tokens, cost and
-- latency — everything an operator needs to see what the feature costs. What it had no
-- room for was a *conversation*: each row stood alone, so a follow-up like "and the week
-- before?" had nothing to refer back to.
--
-- Kept on the same table rather than split into messages. Every row is still one
-- question and its answer, the cost accounting stays where the usage counter already
-- reads it, and threading is one nullable column rather than a join.

ALTER TABLE ai_queries
  -- Null for rows written before threading existed, and for one-off questions.
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  -- The assistant's prose. `insight` and `title` describe a chart; an agent that answered
  -- "traffic is up 12% week on week" has no chart and needs somewhere to put the sentence.
  ADD COLUMN IF NOT EXISTS answer text,
  -- Which tools ran, with their arguments. This is the audit trail: for a feature that can
  -- draft changes to a customer's site, "what did it actually look at" has to be answerable
  -- afterwards, not inferred from the prose.
  ADD COLUMN IF NOT EXISTS tool_calls jsonb,
  -- The draft a propose_* tool produced, if any. Stored so the confirmation step reads what
  -- was actually proposed rather than trusting a client to send it back unmodified — a
  -- round-trip through the browser is a chance to change the payload after approval.
  ADD COLUMN IF NOT EXISTS proposal jsonb,
  -- Set when an approved proposal is created, so a draft cannot be confirmed twice.
  ADD COLUMN IF NOT EXISTS proposal_applied_at timestamptz;

-- The history read: one conversation, oldest first.
CREATE INDEX IF NOT EXISTS ix_ai_queries_conversation
  ON ai_queries (conversation_id, created_at)
  WHERE conversation_id IS NOT NULL;

-- The admin cost view: spend over a window, newest first.
CREATE INDEX IF NOT EXISTS ix_ai_queries_created
  ON ai_queries (created_at DESC);
