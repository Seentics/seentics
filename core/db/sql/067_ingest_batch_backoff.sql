-- Retry a failed ingest batch with backoff instead of on the next tick.
--
-- `markBatchFailed` used to clear the lease and leave the row immediately claimable. At a
-- 250ms poll and five attempts, a batch burned every retry in about a second — so a 5-10s
-- database failover or object-storage blip parked whole lanes' worth of data, and nothing
-- ever took a parked batch back. `next_attempt_at` is the not-before time a failure now
-- writes, growing exponentially to minutes; the claim query skips a batch until it passes.
--
-- `requeues` counts how many times the health sweep has given a parked batch a fresh set of
-- attempts after a cool-off. Capped, so a genuinely poisoned batch settles as parked rather
-- than cycling forever.
--
-- No index: both columns are only read on rows the pending/parked scans already visit.
--
-- Idempotent, like every file in this directory.

ALTER TABLE ingest_batches
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

ALTER TABLE ingest_batches
  ADD COLUMN IF NOT EXISTS requeues integer NOT NULL DEFAULT 0;
