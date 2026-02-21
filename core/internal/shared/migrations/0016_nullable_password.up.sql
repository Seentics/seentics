-- Support OAuth-only users in core by making password_hash nullable
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
