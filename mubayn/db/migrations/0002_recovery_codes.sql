-- Accounts on a deployment without e-mail (EMAIL_DRIVER=none) reset their
-- password with a one-time recovery code instead of an e-mailed link.
-- Only the SHA-256 of the code is stored; the code itself is shown once.
ALTER TABLE users ADD COLUMN recovery_code_hash bytea;
ALTER TABLE users ADD COLUMN recovery_code_created_at timestamptz;
