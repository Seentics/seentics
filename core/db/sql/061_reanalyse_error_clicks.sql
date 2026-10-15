-- Error clicks used to count any request that got no response (status 0) — which is also what
-- a browser reports for a request an ad blocker stopped, or one cancelled when the visitor
-- clicked through to another page. Detection now counts only real failures
-- (frustration-detection.ts isRealRequestFailure).
--
-- Analyses that found an error click are dropped so they are worked out again under the new
-- rule: on the session's next view, or by the analysis job for recent sessions. Only these rows;
-- the rest of the stored analyses, and their summaries, are unaffected. Runs once.
DELETE FROM session_analyses
 WHERE COALESCE((signal_counts->>'error_click')::int, 0) > 0;
