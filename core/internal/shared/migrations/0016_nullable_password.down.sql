-- Revert password_hash to NOT NULL
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
