CREATE TABLE workspace_selection (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    snapshot_revision INTEGER NOT NULL CHECK (snapshot_revision BETWEEN 1 AND 9007199254740991),
    selection_revision INTEGER NOT NULL CHECK (selection_revision BETWEEN snapshot_revision AND 9007199254740991),
    encrypted_active_school BLOB NOT NULL CHECK (length(encrypted_active_school) BETWEEN 29 AND 512),
    encrypted_school_ids BLOB NOT NULL CHECK (length(encrypted_school_ids) BETWEEN 29 AND 65536)
) STRICT;

PRAGMA user_version = 6;
