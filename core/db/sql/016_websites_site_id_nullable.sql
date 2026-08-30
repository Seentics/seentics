-- `websites.site_id` is dead, but dropping it is not this migration's job.
--
-- The column was the short public id, before websites were keyed by a single UUID.
-- The commit that unified them removed `siteId` from the Drizzle schema and shipped no
-- migration, so the column stayed behind as `text NOT NULL UNIQUE` while the insert
-- stopped supplying it — every attempt to create a website has failed since with
-- "null value in column site_id violates not-null constraint".
--
-- Dropping the constraint unblocks that and destroys nothing. Dropping the *column* is
-- deliberately left for later: nothing in this codebase reads it, but it is the only
-- surviving record of the old id, and a migration that runs on every startup is the
-- wrong place to find out something outside this repository still wanted it. Multiple
-- NULLs are permitted under a UNIQUE index, so new rows insert cleanly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'websites'
      AND column_name  = 'site_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE websites ALTER COLUMN site_id DROP NOT NULL;
    RAISE NOTICE 'websites.site_id is now nullable; the column itself is unused and may be dropped once confirmed';
  END IF;
END $$;
