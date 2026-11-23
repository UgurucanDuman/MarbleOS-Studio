CREATE TABLE vault_key (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    dpapi_wrapped_dek BLOB NOT NULL CHECK (length(dpapi_wrapped_dek) BETWEEN 32 AND 4096),
    recovery_wrapped_dek BLOB CHECK (recovery_wrapped_dek IS NULL OR length(recovery_wrapped_dek) = 68),
    recovery_salt BLOB CHECK (recovery_salt IS NULL OR length(recovery_salt) = 16),
    recovery_fingerprint TEXT CHECK (recovery_fingerprint IS NULL OR length(recovery_fingerprint) = 8),
    recovery_configured_at TEXT CHECK (recovery_configured_at IS NULL OR length(recovery_configured_at) BETWEEN 1 AND 50),
    CHECK (
        (recovery_wrapped_dek IS NULL AND recovery_salt IS NULL AND recovery_fingerprint IS NULL AND recovery_configured_at IS NULL)
        OR (recovery_wrapped_dek IS NOT NULL AND recovery_salt IS NOT NULL AND recovery_fingerprint IS NOT NULL AND recovery_configured_at IS NOT NULL)
    )
) STRICT;

PRAGMA user_version = 4;

