CREATE TABLE desktop_personalization (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    encrypted_state BLOB NOT NULL CHECK (length(encrypted_state) BETWEEN 29 AND 262144),
    updated_at TEXT NOT NULL CHECK (length(updated_at) BETWEEN 1 AND 50)
) STRICT;

CREATE TABLE desktop_assets (
    asset_key TEXT PRIMARY KEY CHECK (length(asset_key) BETWEEN 36 AND 45),
    file_id TEXT NOT NULL CHECK (length(file_id) = 36),
    created_at TEXT NOT NULL CHECK (length(created_at) BETWEEN 1 AND 50)
) STRICT;

PRAGMA user_version = 5;

