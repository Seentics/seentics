CREATE TABLE IF NOT EXISTS obs_error_groups (
    fingerprint  TEXT        NOT NULL,
    project_id   TEXT        NOT NULL,
    service      TEXT        NOT NULL,
    error_type   TEXT        NOT NULL,
    message      TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'open',
    first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    count        BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (fingerprint, project_id)
);

CREATE INDEX IF NOT EXISTS idx_obs_error_groups_project
    ON obs_error_groups (project_id);

CREATE INDEX IF NOT EXISTS idx_obs_error_groups_project_status
    ON obs_error_groups (project_id, status);

CREATE INDEX IF NOT EXISTS idx_obs_error_groups_last_seen
    ON obs_error_groups (project_id, last_seen DESC);
