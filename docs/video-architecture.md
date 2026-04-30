# 视频转码与在线播放架构设计

## 背景

当前项目已经具备以下基础能力：

- 前端通过 Worker 获取 R2 预签名上传链接。
- 文件元数据通过 D1 的 `items` 表管理。
- 文件下载与预览仍由 Worker 提供访问入口。

接下来的目标是在不破坏现有上传链路的前提下，为视频文件增加“上传后异步转码 + 在线播放”能力。

本设计先固定两个边界：

1. 第一版暂不引入用户认证系统，不实现 JWT / Session / 分享链接鉴权。
2. 转码节点采用本地 `Mac Mini`，通过轮询 Worker 任务接口的方式领取任务，不采用 Webhook 作为主链路。

## 设计目标

- 保持当前 `Presigned URL -> R2` 的大文件上传方案不变。
- 将视频转码从主上传流程中解耦，改为异步处理。
- 让 Worker 继续作为编排层，统一管理任务状态、播放入口和数据回写。
- 让 `Mac Mini` 只承担“领取任务 -> 下载原片 -> 转码 -> 上传产物 -> 回写结果”的执行责任。
- 先完成单用户、无认证、可验证的最小闭环，再考虑权限控制和多节点扩展。

## 总体方案

整体链路如下：

1. 前端上传视频到 R2 原片路径。
2. 前端调用 Worker 创建 `items` 文件记录。
3. Worker 判断文件类型为视频后，写入视频状态和转码任务。
4. `Mac Mini` 定时轮询 Worker 的任务 claim 接口。
5. `Mac Mini` 领取任务后，从 R2 拉取原片并执行 FFmpeg 转码。
6. 转码后的 HLS 产物和缩略图上传回 R2。
7. `Mac Mini` 调用 Worker 的结果回写接口，更新 D1 中的视频元数据和任务状态。
8. 前端看到视频状态为 `completed` 后，请求 Worker 的视频流接口播放。

## 为什么主链路采用轮询，而不是 Webhook

本项目中的 `Mac Mini` 是家庭网络中的边缘节点，不具备云服务那样稳定的在线能力。相比 Webhook，轮询的主链路更适合当前阶段，原因如下：

- 任务先落库，`Mac Mini` 离线或休眠时不会丢任务。
- D1 可以作为唯一状态源，避免“Worker 已通知但节点未收到”的中间态。
- claim 机制更容易实现幂等和防重复消费。
- 运维复杂度更低，不强依赖 Tunnel 入站持续稳定。
- 后续如果要扩展多台转码节点，轮询 + claim 更容易演进为标准任务队列模型。

Webhook 未来可以作为“加速唤醒”补充，但不应作为第一版的唯一触发方式。

## 角色分工

### 前端

- 保持现有上传逻辑。
- 上传完成后创建文件元数据。
- 根据视频状态展示“待转码 / 转码中 / 可播放 / 失败”。
- 在视频就绪后，通过 Worker 提供的播放地址接入 `hls.js`。

### Worker

- 负责视频文件识别和任务创建。
- 提供任务 claim、状态更新、结果回写接口。
- 提供视频播放代理接口。
- 负责维护 D1 中的状态机。

### Mac Mini

- 周期性轮询 claim 接口领取任务。
- 从 R2 下载原片。
- 使用 FFmpeg 执行切片或转码。
- 上传 `index.m3u8`、分片文件和缩略图到 R2。
- 调用 Worker 回写视频元数据和任务结果。

## 数据模型

第一版保留 `items` 作为主表，并增加视频结果字段；同时新增 `media_jobs` 记录处理过程态。当前实现以 `worker/schema.sql` 和 `worker/migrations/` 为准。

### items 表新增字段

- `mediaType TEXT`
  - 非媒体文件为 `NULL`
  - 视频文件为 `video`
- `videoStatus TEXT`
  - 可选值：`pending`、`processing`、`completed`、`failed`
- `hlsPath TEXT`
  - 例如：`hls/{fileId}/index.m3u8`
- `thumbnailPath TEXT`
  - 例如：`thumbnails/{fileId}.jpg`
- `duration INTEGER`
  - 视频时长，单位秒
- `width INTEGER`
- `height INTEGER`
- `videoError TEXT`
  - 最近一次转码失败原因

### media_jobs 表字段

- `id TEXT PRIMARY KEY`
- `itemId TEXT NOT NULL`
- `status TEXT NOT NULL`
  - `pending`、`processing`、`completed`、`failed`
- `workerId TEXT`
  - 领取任务的转码节点标识，例如 `mac-mini-01`
- `errorMessage TEXT`
- `createdAt DATETIME DEFAULT CURRENT_TIMESTAMP`
- `updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`
- `claimedAt DATETIME`
- `completedAt DATETIME`

### 设计原因

- `items` 保存当前可读的业务结果态。
- `media_jobs` 保存任务执行过程态，便于重试、排障和未来扩展。
- 第一版任务表保持精简，不包含 `jobType`、`attemptCount` 等扩展字段；后续做多媒体任务类型或自动重试时再迁移新增。

## R2 路径建议

- 原片：`files/{uuid}`
- HLS 清单：`hls/{fileId}/index.m3u8`
- HLS 分片：`hls/{fileId}/segment-00000.ts`
- 缩略图：`thumbnails/{fileId}.jpg`

路径建议保持稳定，不把真实 R2 路径暴露给前端。

## 状态流转

### items.videoStatus

- `NULL`
  - 非视频文件
- `pending`
  - 文件已落库，等待转码
- `processing`
  - 节点已领取任务，正在处理
- `completed`
  - HLS 与元数据已就绪，可播放
- `failed`
  - 处理失败，等待人工重试或后续自动重试

### media_jobs.status

- `pending`
- `processing`
- `completed`
- `failed`

`items.videoStatus` 面向业务展示，`media_jobs.status` 面向任务执行与排障。

## 接口设计

### 1. 创建文件记录

`POST /api/items`

在现有创建文件记录逻辑基础上补充：

- 判断 `contentType` 是否为视频。
- 若为视频：
  - 设置 `mediaType = 'video'`
  - 设置 `videoStatus = 'pending'`
  - 新增一条 `media_jobs` 记录

### 2. claim 任务

`POST /api/media/jobs/claim`

请求体：

```json
{
  "workerId": "mac-mini-01"
}
```

响应语义：

- 有任务：原子性地把一条 `pending` 任务置为 `processing`，并返回任务信息。
- 无任务：返回 `204 No Content`。

返回任务内容包括：

- `jobId`
- `itemId`
- `fileName`
- `sourceR2Key`
- `contentType`

### 3. 回写处理中状态

如果 claim 接口已经原子更新为 `processing`，则不一定需要单独接口。第一版可以省略。

### 4. 回写转码结果

`PATCH /api/items/:id/video-metadata`

请求体包含：

- `videoStatus`
- `hlsPath`
- `thumbnailPath`
- `duration`
- `width`
- `height`
- `jobId`
- `errorMessage`

处理逻辑：

- 成功时更新 `items` 和 `media_jobs`
- 失败时将状态写为 `failed`
- 仅允许任务所属的 `jobId` 回写，避免错误覆盖

### 5. 视频流接口

- `GET /api/video/stream/:fileId/index.m3u8`
- `GET /api/video/stream/:fileId/:segmentName`

第一版暂不做认证，但仍建议由 Worker 统一代理访问：

- 隐藏真实 R2 路径
- 正确设置 `Content-Type`
- 后续可以无缝接入鉴权和缓存控制

### 6. 删除视频文件

`DELETE /api/items/:id`

视频文件删除需要同时清理：

- 原始 R2 对象：`items.r2Key`
- HLS 产物前缀：`hls/{fileId}/`
- 缩略图：`items.thumbnailPath`
- 任务记录：`media_jobs`
- 文件元数据：`items`

如果视频仍处于 `processing`，Worker 返回 `409`，避免本地转码进程正在写入产物时被删除造成竞态和孤儿对象。

## 播放策略

第一版播放器策略保持简单：

- 前端读取文件条目中的 `videoStatus`
- `pending` / `processing`：展示“视频处理中”
- `failed`：展示失败状态
- `completed`：打开视频播放 modal，Safari 使用原生 HLS，其他浏览器动态加载 `hls.js`

第一版先不做：

- 清晰度切换
- 多码率自适应
- 字幕
- 分享播放

## 轮询策略建议

`Mac Mini` 的轮询本身资源消耗很低，真正的资源消耗来自 FFmpeg 转码。

第一版实现：

- 默认每 `5 秒` 请求一次 claim 接口
- 无任务时等待 `10 秒`
- 处理完任务后等待 `5 秒` 再继续 claim
- 如果出现网络错误或 Worker 异常，等待 `30 秒`

这样可以兼顾：

- 上传后较快开始转码
- 空闲时减少无意义请求
- 异常时自动自我保护

## FFmpeg 策略建议

第一版目标是尽快打通链路，优先保证成功率，不追求一步到位的复杂转码能力。

第一版当前统一转为 H.264 + AAC，并输出 MPEG-TS HLS 分片，优先保证浏览器兼容性和链路稳定。后续再考虑：

- 兼容源文件的仅切片优化
- 多码率
- fMP4 分片
- 更细粒度的转码模板

## 缓存与代理建议

即使第一版不做认证，也建议保留 Worker 代理层，而不是让前端直接访问 R2 的 HLS 文件。

原因：

- 后续加认证时不需要改前端播放地址
- 可以统一处理播放日志
- 可以逐步引入边缘缓存
- 可以避免真实对象路径暴露

## 第一阶段实施计划

### 阶段 1：数据库与数据模型

- 为 `items` 增加视频相关字段
- 新增 `media_jobs` 表
- 更新 `docs/db.md`
- 状态：已完成，使用 `worker/migrations/0001_video_transcoding.sql` 迁移本地与远程 D1

### 阶段 2：Worker 任务编排

- 扩展 `POST /api/items` 以识别视频并创建任务
- 新增 claim 接口
- 新增转码结果回写接口
- 新增视频流代理接口
- 状态：已完成，并已部署到远程 Worker

### 阶段 3：Mac Mini 转码服务

- 建立本地 Node.js 服务
- 实现轮询调度器
- 集成 FFmpeg
- 集成 R2 下载与上传
- 处理本地临时文件清理
- 状态：已完成，位于 `transcoder/` workspace

### 阶段 4：前端播放器与状态展示

- 文件列表展示视频状态
- 新增视频预览或播放入口
- 接入 `hls.js`
- 处理失败和处理中占位态
- 状态：已完成，`hls.js` 采用动态加载

## 当前决策结论

本阶段确认采用以下架构决策：

- 暂不引入认证系统，先完成单用户无认证闭环。
- 转码节点使用本地 `Mac Mini`。
- `Mac Mini` 通过轮询 claim 任务接口工作。
- Worker 负责统一编排任务和代理视频播放。
- D1 同时保存文件结果态和任务过程态。

该方案的重点不是“先把视频播起来”，而是先建立一条稳定、可恢复、可扩展的异步媒体处理管线。
