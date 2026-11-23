CREATE TABLE workspace (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
    encrypted_snapshot BLOB NOT NULL CHECK (length(encrypted_snapshot) > 0)
) STRICT;

CREATE TABLE assets (
    id TEXT PRIMARY KEY CHECK (length(id) = 36)
) STRICT;

PRAGMA user_version = 1;
