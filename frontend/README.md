# CloudNet Frontend

这是 CloudNet 的前端应用，基于 React + Vite + TypeScript + Tailwind CSS v4 构建。它负责文件浏览、文件夹导航、上传下载、图片预览和 HLS 视频播放。

## 功能

- 文件和文件夹列表展示。
- 面包屑导航和返回上级目录。
- 创建文件夹。
- 拖拽上传和按钮上传。
- R2 预签名 URL 直传文件。
- 文件下载。
- 图片预览。
- 视频转码状态展示。
- 已完成转码的视频 HLS 播放。

## 技术栈

- React
- Vite
- TypeScript
- Tailwind CSS v4
- Lucide React
- hls.js

## 环境变量

前端通过 `VITE_API_BASE_URL` 指向 Worker API。

本地开发：

```env
VITE_API_BASE_URL=http://localhost:8787/api
```

远程联调：

```env
VITE_API_BASE_URL=https://worker.your-subdomain.workers.dev/api
```

当前约定：

- `.env.development`：本地 Worker。
- `.env.remote`：远程 Worker 联调。

`.env.remote` 会被 `.gitignore` 忽略，避免提交个人环境配置。

## 开发命令

在仓库根目录执行：

```bash
npm run dev --workspace=frontend
```

或进入 `frontend/` 后执行：

```bash
npm run dev
```

连接远程 Worker：

```bash
npm run dev:remote --workspace=frontend
```

构建：

```bash
npm run build --workspace=frontend
```

预览构建产物：

```bash
npm run preview --workspace=frontend
```

## API 调用约定

前端 API 封装在 `src/api/fileService.ts`。

主要接口：

- `GET /api/items?parentId=:parentId`
- `POST /api/folders`
- `POST /api/items/upload`
- `POST /api/items`
- `GET /api/items/:id/download`
- `GET /api/items/:id/preview`
- `DELETE /api/items/:id`
- `GET /api/video/stream/:fileId/index.m3u8`

上传文件采用二阶段流程：

```text
POST /api/items/upload
  -> 获取 R2 预签名 PUT URL
  -> 前端直接 PUT 文件到 R2
  -> POST /api/items 保存元数据
```

如果上传的是 `video/*`，Worker 会创建视频转码任务。前端刷新列表后会根据 `videoStatus` 显示：

- `Queued`
- `Processing`
- `Ready to play`
- `Processing failed`

## HLS 播放

视频完成转码后，点击播放按钮会打开播放器 modal。

播放策略：

- Safari 等原生支持 HLS 的浏览器直接使用 `<video>`。
- 其他浏览器动态加载 `hls.js`。
- 播放地址由 Worker 代理生成，不直接暴露 R2 对象路径。

## 目录说明

```text
src/
├── api/
│   └── fileService.ts   # Worker API 调用封装
├── App.tsx              # 主界面、上传、预览、播放逻辑
├── index.css            # Tailwind 入口和全局样式
└── main.tsx             # React 入口
```

## 部署

前端可以部署到 Cloudflare Pages。

推荐配置：

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

Pages 环境变量：

```env
VITE_API_BASE_URL=https://worker.your-subdomain.workers.dev/api
```

更完整的部署步骤见根目录 `docs/deploy.md`。
