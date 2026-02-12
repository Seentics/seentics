-- Add country_code column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS country_code CHARACTER VARYING(10);

-- Create index for faster filtering and grouping by country_code
CREATE INDEX IF NOT EXISTS idx_events_country_code ON events (country_code);
