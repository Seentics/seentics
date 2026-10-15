-- Operating systems are grouped without their version (modules/analytics/lib/dimension-sql.ts),
-- but Windows carries its kernel version, "Windows NT 10.0", which grouped as "Windows NT".
-- Grouping now also drops the "NT", so new days say "Windows"; this renames the days already
-- built, so a window spanning the change shows one Windows row, not two. Runs once.
DO $$
BEGIN
  IF to_regclass('analytics_rollup_daily') IS NOT NULL THEN
    UPDATE analytics_rollup_daily d SET value = 'Windows'
     WHERE d.dimension = 'os' AND d.value = 'Windows NT'
       AND NOT EXISTS (
         SELECT 1 FROM analytics_rollup_daily w
          WHERE w.website_id = d.website_id AND w.dimension = 'os' AND w.day = d.day AND w.value = 'Windows'
       );
  END IF;
  IF to_regclass('analytics_rollup_sessions') IS NOT NULL THEN
    UPDATE analytics_rollup_sessions SET os = 'Windows' WHERE os = 'Windows NT';
  END IF;
END $$;
