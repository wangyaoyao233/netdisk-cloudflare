-- 网盘元数据表
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,          -- 唯一 ID (UUID)
    parentId TEXT,                -- 父文件夹 ID (根目录为 'root')
    name TEXT NOT NULL,           -- 显示名称
    type TEXT NOT NULL,           -- 'file' 或 'folder'
    size INTEGER,                 -- 文件大小 (文件夹为 NULL)
    contentType TEXT,             -- MIME 类型
    r2Key TEXT,                   -- 在 R2 桶中的实际 Key (通常为 UUID)
    mediaType TEXT,               -- 媒体类型，如 'video'
    videoStatus TEXT,             -- pending / processing / completed / failed
    hlsPath TEXT,                 -- HLS 播放列表路径
    thumbnailPath TEXT,           -- 视频缩略图路径
    duration INTEGER,             -- 视频时长，单位秒
    width INTEGER,                -- 视频宽度
    height INTEGER,               -- 视频高度
    videoError TEXT,              -- 最近一次视频处理错误
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引：加速按父目录查询
CREATE INDEX IF NOT EXISTS idx_items_parentId ON items(parentId);

-- 视频转码任务表
CREATE TABLE IF NOT EXISTS media_jobs (
    id TEXT PRIMARY KEY,
    itemId TEXT NOT NULL,
    status TEXT NOT NULL,         -- pending / processing / completed / failed
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
