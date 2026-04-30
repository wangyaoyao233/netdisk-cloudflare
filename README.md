# CloudNet

CloudNet 是一个基于 Cloudflare 平台的个人网盘项目。它使用 R2 保存文件对象，D1 保存文件系统元数据，Worker 提供 API 与 HLS 代理，本地 `transcoder` 服务负责视频转码。

当前已支持：

- 文件夹浏览、面包屑导航和拖拽上传。
- 通过 R2 S3 预签名 URL 直传/下载文件。
- 使用 D1 管理文件、文件夹和视频处理状态。
- 上传视频后异步转码为 HLS。
- 通过 Worker 代理播放私有 R2 中的 HLS 视频。

## 项目结构

```text
.
├── frontend/      # React + Vite + TypeScript + Tailwind CSS v4
├── worker/        # Cloudflare Worker API, D1, R2, HLS proxy
├── transcoder/    # 本地 Node.js + FFmpeg 转码服务
└── docs/          # 架构、数据库、部署文档和开发日志
```

## 技术栈

- Frontend: React, Vite, TypeScript, Tailwind CSS v4, hls.js
- Worker: Cloudflare Workers, Native Fetch API
- Database: Cloudflare D1
- Storage: Cloudflare R2
- Transcoding: Node.js, FFmpeg, FFprobe
- Monorepo: npm workspaces

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Worker 本地环境

在 `worker/.dev.vars` 中配置 R2 凭据：

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
BUCKET_NAME=test
```

### 3. 初始化或迁移 D1

新本地库可以直接初始化：

```bash
cd worker
npx wrangler d1 execute netdisk-db --local --file=./schema.sql
```

已有本地库使用 migrations：

```bash
cd worker
npx wrangler d1 migrations apply netdisk-db --local
```

远程 D1 使用：

```bash
cd worker
npx wrangler d1 migrations apply netdisk-db --remote
```

### 4. 启动前端和 Worker

在根目录执行：

```bash
npm run dev
```

默认地址：

- Frontend: `http://localhost:5173`
- Worker: `http://localhost:8787`

### 5. 启动本地转码服务

需要先安装 `ffmpeg` 和 `ffprobe`。

macOS:

```bash
brew install ffmpeg
```

配置 `transcoder/.dev.vars`：

```env
WORKER_API_BASE_URL=http://127.0.0.1:8787
WORKER_CLAIM_PATH=/api/media/jobs/claim
WORKER_RESULT_PATH_TEMPLATE=/api/items/{itemId}/video-metadata
TRANSCODER_WORKER_ID=mac-mini-01
R2_ACCOUNT_ID=your-account-id
R2_BUCKET_NAME=test
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
```

启动：

```bash
npm run dev --workspace=transcoder
```

## 云端联调

前端连接已部署 Worker：

```bash
npm run dev:remote --workspace=frontend
```

本地 transcoder 连接已部署 Worker：

```bash
npm run dev:remote --workspace=transcoder
```

对应环境文件：

- `frontend/.env.remote`
- `transcoder/.env.remote.local`

这些本地环境文件会被 `.gitignore` 忽略。

## 常用命令

```bash
# 前端 + 本地 Worker
npm run dev

# 前端构建
npm run build --workspace=frontend

# Worker 测试
npm run test --workspace=worker

# Worker 部署
npm run deploy:worker

# transcoder 构建
npm run build --workspace=transcoder
```

## 视频处理流程

```text
前端上传视频到 R2
  -> Worker 创建 items 记录和 media_jobs 任务
  -> transcoder 轮询 claim 任务
  -> transcoder 从 R2 下载原片
  -> FFmpeg 生成 HLS 和缩略图
  -> transcoder 上传 hls/{itemId}/... 与 thumbnails/{itemId}.jpg
  -> transcoder 回写 Worker
  -> 前端通过 Worker HLS 代理播放
```

HLS 代理接口：

```text
GET /api/video/stream/:fileId/index.m3u8
GET /api/video/stream/:fileId/:segmentName
```

## 文档

- `docs/video-architecture.md`：视频转码与在线播放架构。
- `docs/db.md`：D1 表结构、迁移和数据模型。
- `docs/deploy.md`：Cloudflare 部署、远程联调和转码服务配置。
- `docs/transcoder.md`：Mac Mini 上长期运行转码服务的操作流程。
- `docs/daily.md`：开发日志。

## License

ISC License
