-- 网盘元数据表
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,          -- 唯一 ID (UUID)
    parentId TEXT,                -- 父文件夹 ID (根目录为 'root')
    name TEXT NOT NULL,           -- 显示名称
    type TEXT NOT NULL,           -- 'file' 或 'folder'
    size INTEGER,                 -- 文件大小 (文件夹为 NULL)
    contentType TEXT,             -- MIME 类型
    r2Key TEXT,                   -- 在 R2 桶中的实际 Key (通常为 UUID)
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引：加速按父目录查询
CREATE INDEX IF NOT EXISTS idx_items_parentId ON items(parentId);
