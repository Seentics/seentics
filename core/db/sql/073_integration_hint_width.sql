-- A webhook's hint now carries its host as well as the last characters of its path
-- ("hooks.slack.com …b71d"): the host is not the secret, and it lets the dashboard show which tool
-- the hook goes to. Eight characters held only the path's tail; 120 matches conversion_destinations.

ALTER TABLE integration_connections ALTER COLUMN credentials_hint TYPE VARCHAR(120);
