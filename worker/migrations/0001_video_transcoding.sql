ALTER TABLE items ADD COLUMN mediaType TEXT;
ALTER TABLE items ADD COLUMN videoStatus TEXT;
ALTER TABLE items ADD COLUMN hlsPath TEXT;
ALTER TABLE items ADD COLUMN thumbnailPath TEXT;
ALTER TABLE items ADD COLUMN duration INTEGER;
ALTER TABLE items ADD COLUMN width INTEGER;
ALTER TABLE items ADD COLUMN height INTEGER;
ALTER TABLE items ADD COLUMN videoError TEXT;

CREATE TABLE IF NOT EXISTS media_jobs (
    id TEXT PRIMARY KEY,
    itemId TEXT NOT NULL,
    status TEXT NOT NULL,
    workerId TEXT,
    errorMessage TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    claimedAt DATETIME,
    completedAt DATETIME,
    FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_jobs_status_createdAt ON media_jobs(status, createdAt);
CREATE INDEX IF NOT EXISTS idx_media_jobs_itemId ON media_jobs(itemId);
