CREATE TABLE asset_cleanup (
    id TEXT PRIMARY KEY CHECK (length(id) = 36)
) STRICT;

PRAGMA user_version = 2;
