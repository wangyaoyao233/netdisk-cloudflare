# 数据库设计文档 (Cloudflare D1)

本项目采用 **元数据 (Metadata) 与存储 (Storage) 分离** 的架构。Cloudflare D1 负责管理文件系统层级、文件属性和视频处理状态，Cloudflare R2 负责保存原始文件、HLS 分片和缩略图等二进制对象。

## 1. 数据库迁移

数据库结构以 `worker/schema.sql` 和 `worker/migrations/` 为准。

新环境可以直接使用 schema 初始化：

```bash
cd worker
npx wrangler d1 execute netdisk-db --local --file=./schema.sql
npx wrangler d1 execute netdisk-db --remote --file=./schema.sql
```

已有环境应使用 migrations 升级：

```bash
cd worker
npx wrangler d1 migrations apply netdisk-db --local
npx wrangler d1 migrations apply netdisk-db --remote
```

当前 migration：

- `0000_initial.sql`：创建基础 `items` 表和父目录索引。
- `0001_video_transcoding.sql`：为 `items` 增加视频字段，并创建 `media_jobs` 表。

## 2. `items` 表

`items` 是系统主表，用于统一存储文件和文件夹的业务元数据。

```sql
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    parentId TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER,
    contentType TEXT,
    r2Key TEXT,
    mediaType TEXT,
    videoStatus TEXT,
    hlsPath TEXT,
    thumbnailPath TEXT,
    duration INTEGER,
    width INTEGER,
    height INTEGER,
    videoError TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_parentId ON items(parentId);
```

字段说明：

- `id`：条目 ID，文件夹和文件统一使用 UUID。
- `parentId`：父文件夹 ID，根目录为 `root`。
- `name`：用户可见名称。
- `type`：`file` 或 `folder`。
- `size`：文件大小，文件夹为 `NULL`。
- `contentType`：MIME 类型，例如 `video/mp4`。
- `r2Key`：R2 中的原始对象 Key，当前上传路径为 `files/{uuid}`。
- `mediaType`：媒体类型，视频为 `video`，非媒体文件为 `NULL`。
- `videoStatus`：视频处理状态，取值为 `pending`、`processing`、`completed`、`failed`。
- `hlsPath`：HLS playlist 路径，例如 `hls/{itemId}/index.m3u8`。
- `thumbnailPath`：缩略图路径，例如 `thumbnails/{itemId}.jpg`。
- `duration`、`width`、`height`：视频元数据。
- `videoError`：最近一次视频处理失败原因。
- `createdAt`、`updatedAt`：创建和更新时间。

## 3. `media_jobs` 表

`media_jobs` 保存异步媒体任务的过程态。当前第一版只支持视频转码任务，因此没有单独的 `jobType` 字段。

```sql
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
```

字段说明：

- `id`：任务 ID。
- `itemId`：关联的 `items.id`。
- `status`：任务状态，取值为 `pending`、`processing`、`completed`、`failed`。
- `workerId`：领取任务的本地转码节点标识，例如 `mac-mini-01`。
- `errorMessage`：任务失败原因。
- `claimedAt`：任务被领取时间。
- `completedAt`：任务完成或失败时间。

索引说明：

- `idx_media_jobs_status_createdAt`：用于 claim 接口按状态和创建时间领取最早任务。
- `idx_media_jobs_itemId`：用于按文件定位任务。

## 4. 视频状态流转

视频上传成功并创建文件记录后，Worker 会根据 `contentType` 判断是否为视频。

```text
POST /api/items
  -> contentType startsWith video/
  -> items.mediaType = video
  -> items.videoStatus = pending
  -> media_jobs.status = pending
```

本地 `transcoder` 通过 claim 接口领取任务：

```text
pending -> processing
```

转码完成后回写：

```text
processing -> completed
```

失败时回写：

```text
processing -> failed
```

`items.videoStatus` 面向前端展示和播放判断；`media_jobs.status` 面向任务执行和排障。

## 5. R2 路径约定

当前实现使用以下路径：

- 原始文件：`files/{uuid}`
- HLS playlist：`hls/{itemId}/index.m3u8`
- HLS segment：`hls/{itemId}/segment-00000.ts`
- 缩略图：`thumbnails/{itemId}.jpg`

前端不会直接访问这些 R2 路径。HLS 播放统一通过 Worker 代理：

```text
GET /api/video/stream/:fileId/index.m3u8
GET /api/video/stream/:fileId/:segmentName
```

删除视频文件时，Worker 会清理原始文件、`hls/{itemId}/` 前缀下的 HLS 产物、`thumbnailPath` 对应缩略图，并显式删除 `media_jobs` 任务记录。处于 `processing` 的视频会拒绝删除，避免与本地转码写入发生竞态。

## 6. 核心设计思路

### 6.1 逻辑与物理解耦

用户看到的 `name` 存储在 D1，R2 中的 `r2Key` 是随机路径。重命名和移动只需要修改 D1，不需要移动 R2 对象。

### 6.2 统一实体模型

文件和文件夹共用 `items` 表，通过 `type` 区分。目录查询只需要：

```sql
SELECT * FROM items WHERE parentId = ? ORDER BY type DESC, name ASC;
```

### 6.3 异步媒体处理

视频转码不阻塞上传链路。上传完成后只创建任务，真正的 FFmpeg 处理由本地 `transcoder` 轮询执行。

### 6.4 私有对象代理

原片下载、HLS playlist 和 segment 都不直接暴露 R2 对象路径。Worker 作为访问入口，便于后续加入鉴权、缓存和访问审计。
