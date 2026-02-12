-- Add latitude and longitude columns to events table for mapping
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Note: In partitioning, usually you only need to add these to the parent table.
-- PostgreSQL will automatically handle adding them to existing/new partitions
-- if the table is partitioned using the native partitioning system.
