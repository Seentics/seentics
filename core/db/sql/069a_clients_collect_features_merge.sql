-- Before 070 renames clients.features_enabled to collect_features: a database whose schema
-- was pushed from the current Drizzle schema on top of the old one has both columns, and
-- the rename then fails ("column collect_features already exists") and Core never starts.
-- Keep the old column's switches where the new one is still empty, then drop the old
-- column, so 070's rename finds nothing to do. Every other database: no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'features_enabled')
     AND EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'collect_features') THEN
    UPDATE clients SET collect_features = features_enabled
      WHERE collect_features = '{}'::jsonb AND features_enabled IS NOT NULL;
    ALTER TABLE clients DROP COLUMN features_enabled;
  END IF;
END $$;
