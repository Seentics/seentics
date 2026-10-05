-- How long a visitor may take between one funnel step and the next. NULL is no limit, which is
-- what every existing funnel had.
ALTER TABLE IF EXISTS funnels ADD COLUMN IF NOT EXISTS conversion_window_hours integer;
