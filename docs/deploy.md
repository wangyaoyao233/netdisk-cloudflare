# 部署指南 (Deployment Guide)

本项目基于 Cloudflare 生态构建：

- 前端：React + Vite，可部署到 Cloudflare Pages。
- 后端：Cloudflare Worker，负责 API、D1、R2 预签名和 HLS 代理。
- 数据库：Cloudflare D1。
- 存储：Cloudflare R2。
- 转码节点：本地 `transcoder/` Node.js 服务，使用 FFmpeg 轮询云端 Worker 任务。

## 1. 准备工作

部署前请确认：

1. 已登录 Cloudflare 账号。
2. 本地安装 Node.js，建议使用当前项目已验证的现代 Node 版本。
3. 已安装依赖：

```bash
npm install
```

4. Wrangler 可用：

```bash
npx wrangler --version
npx wrangler login
```

## 2. Cloudflare 资源

### 2.1 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create netdisk-db
```

将输出的 `database_id` 写入 `worker/wrangler.jsonc`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "netdisk-db",
    "database_id": "your-database-id"
  }
]
```

### 2.2 创建 R2 Bucket

```bash
cd worker
npx wrangler r2 bucket create test
```

将 bucket 名称写入 `worker/wrangler.jsonc`：

```jsonc
"r2_buckets": [
  {
    "binding": "MY_BUCKET",
    "bucket_name": "test"
  }
],
"vars": {
  "BUCKET_NAME": "test"
}
```

### 2.3 配置 R2 S3 API 凭据

Worker 需要 R2 S3 API 凭据来生成上传/下载预签名 URL；`transcoder` 也需要同一组凭据读写 R2。

本地开发写入 `worker/.dev.vars`：

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
BUCKET_NAME=test
```

生产 Worker 建议把密钥作为 secret：

```bash
cd worker
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`BUCKET_NAME` 当前可放在 `wrangler.jsonc` 的 `vars` 中；如果安全策略要求更严格，也可以改为 secrets。

## 3. D1 数据库迁移

新环境可以直接用 schema 初始化：

```bash
cd worker
npx wrangler d1 execute netdisk-db --local --file=./schema.sql
npx wrangler d1 execute netdisk-db --remote --file=./schema.sql
```

已有环境应使用 migrations：

```bash
cd worker
npx wrangler d1 migrations apply netdisk-db --local
npx wrangler d1 migrations apply netdisk-db --remote
```

当前 migrations：

- `0000_initial.sql`：基础文件系统表。
- `0001_video_transcoding.sql`：视频字段和 `media_jobs` 表。

修改数据库结构后，不要只改 `schema.sql`；应同时新增 migration，并在部署前应用到远程 D1。

## 4. Worker 部署

在根目录执行：

```bash
npm run deploy:worker
```

或在 `worker/` 目录执行：

```bash
npm run deploy
```

部署后记录 Worker 地址，例如：

```text
https://worker.your-subdomain.workers.dev
```

基础验证：

```bash
curl https://worker.your-subdomain.workers.dev/ping
```

应返回：

```text
pong
```

## 5. 前端部署

前端位于 `frontend/`，使用 Vite。

### 5.1 本地连接远程 Worker 测试

`frontend/.env.remote` 用于本地远程联调，内容格式为：

```env
VITE_API_BASE_URL=https://worker.your-subdomain.workers.dev/api
```

启动：

```bash
npm run dev:remote --workspace=frontend
```

### 5.2 Cloudflare Pages 部署

在 Cloudflare Pages 中设置：

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

Pages 环境变量：

```env
VITE_API_BASE_URL=https://worker.your-subdomain.workers.dev/api
```

注意必须包含协议头 `https://`，并推荐带 `/api` 后缀。

### 5.3 Wrangler Pages 部署

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=netdisk-frontend
```

## 6. 本地转码服务部署

`transcoder/` 是本地常驻服务，用于轮询 Worker 的转码任务，下载 R2 原片，执行 FFmpeg，上传 HLS 产物和缩略图，并回写 D1 状态。

### 6.1 系统依赖

需要本机安装：

```bash
ffmpeg
ffprobe
```

macOS 可使用：

```bash
brew install ffmpeg
```

### 6.2 本地 Worker 联调

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

### 6.3 云端 Worker 联调

配置 `transcoder/.env.remote.local`：

```env
WORKER_API_BASE_URL=https://worker.your-subdomain.workers.dev
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
npm run dev:remote --workspace=transcoder
```

`transcoder/.dev.vars` 和 `transcoder/.env.remote.local` 包含密钥，已被 `.gitignore` 忽略，不要提交。

Mac Mini 上长期后台运行请参考 `docs/transcoder.md`。

## 7. 视频播放链路验证

1. 启动或部署 Worker，并确认远程 D1 已应用 migrations。
2. 启动前端。
3. 启动 `transcoder`。
4. 在前端上传 `video/mp4` 文件。
5. Worker 创建 `items.videoStatus = pending` 和一条 `media_jobs`。
6. `transcoder` claim 任务并执行 FFmpeg。
7. R2 出现：

```text
hls/{itemId}/index.m3u8
hls/{itemId}/segment-00000.ts
thumbnails/{itemId}.jpg
```

8. D1 中对应 `items.videoStatus` 变为 `completed`。
9. 前端刷新列表后显示 `Ready to play`，点击播放按钮通过 Worker HLS 代理播放。

HLS 代理接口：

```text
GET /api/video/stream/:fileId/index.m3u8
GET /api/video/stream/:fileId/:segmentName
```

## 8. CI/CD 自动化部署

### 8.1 前端

Cloudflare Pages 可以直接关联 GitHub 仓库，监听 `main` 分支自动构建部署。

### 8.2 Worker

项目包含 `.github/workflows/deploy.yml` 时，可使用 GitHub Actions 部署 Worker。

Cloudflare API Token 至少需要：

- Account | Workers Scripts | Edit
- Account | Cloudflare R2 Storage | Edit
- Account | D1 | Edit
- Account | Account Settings | Read
- User | User Details | Read

在 GitHub 仓库中配置：

```text
CLOUDFLARE_API_TOKEN
```

注意：CI 部署 Worker 不会自动帮你执行 D1 migrations。涉及数据库结构变更时，应先手动或通过独立流程执行：

```bash
cd worker
npx wrangler d1 migrations apply netdisk-db --remote
```

## 9. 常见问题

### CORS 问题

Worker 当前对 API 和 HLS 代理返回 CORS 头。前端 `VITE_API_BASE_URL` 必须正确指向 Worker `/api` 前缀。

### 视频一直处于处理中

检查：

- `transcoder` 是否运行。
- `transcoder` 是否指向正确的 `WORKER_API_BASE_URL`。
- R2 凭据是否与 Worker 使用同一个 bucket。
- `media_jobs` 中任务是否卡在 `processing`。

### 视频完成但无法播放

检查：

- R2 是否存在 `hls/{itemId}/index.m3u8` 和 segment 文件。
- `items.hlsPath` 是否为 `hls/{itemId}/index.m3u8`。
- Worker 是否已部署包含 HLS 代理接口的最新版本。
