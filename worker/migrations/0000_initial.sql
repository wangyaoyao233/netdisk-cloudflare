CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    parentId TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    contentType TEXT,
    r2Key TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_parentId ON items(parentId);
