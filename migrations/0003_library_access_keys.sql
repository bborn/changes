CREATE TABLE IF NOT EXISTS library_access_keys (
 key_hash TEXT PRIMARY KEY,
 library_id TEXT NOT NULL REFERENCES libraries(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
