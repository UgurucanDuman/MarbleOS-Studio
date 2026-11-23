ALTER TABLE assets ADD COLUMN folder TEXT;
ALTER TABLE asset_cleanup ADD COLUMN folder TEXT;
PRAGMA user_version = 3;
