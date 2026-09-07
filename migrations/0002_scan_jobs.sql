ALTER TABLE scans ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scans ADD COLUMN updated_at TEXT;
ALTER TABLE scans ADD COLUMN model TEXT;
ALTER TABLE scans ADD COLUMN diagnostic TEXT;
UPDATE scans SET updated_at=created_at;
UPDATE scans SET status='failed',error='This older scan was interrupted. Tap Retry scan to read the saved photo again.' WHERE status='processing';
