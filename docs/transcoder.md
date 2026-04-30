# Transcoder 运行指南

`transcoder/` 是运行在本地 Mac Mini 上的常驻转码服务。它不会部署到 Cloudflare；它只是在本地轮询 Worker 任务队列，并使用 FFmpeg 处理视频。

## 1. 工作方式

```text
transcoder 本地常驻运行
  -> POST /api/media/jobs/claim 领取任务
  -> 从 R2 下载原视频
  -> FFmpeg 生成 HLS 和缩略图
  -> 上传 hls/{itemId}/... 与 thumbnails/{itemId}.jpg 到 R2
  -> PATCH /api/items/{itemId}/video-metadata 回写状态
```

无任务时服务会等待一段时间继续轮询；有任务时会自动处理。

## 2. 运行模式

`transcoder` 始终在 Mac Mini 本地运行。脚本名中的 `remote` 表示连接远程 Worker，而不是把 transcoder 部署到远程服务器。

```text
dev / start:dev
  -> 读取 transcoder/.dev.vars
  -> 连接本地 Worker，例如 http://127.0.0.1:8787

dev:remote / start:remote
  -> 读取 transcoder/.env.remote.local
  -> 连接云端 Worker，例如 https://worker.1wangyumeng.workers.dev
```

## 3. 前置依赖

在 Mac Mini 上安装依赖：

```bash
cd /Volumes/m2_1tb/code/project/netdisk
npm install
brew install ffmpeg
```

确认命令可用：

```bash
which npm
which node
which ffmpeg
which ffprobe
```

当前机器上的路径示例：

```text
/Users/w/.volta/bin/npm
/Users/w/.volta/bin/node
/opt/homebrew/bin/ffmpeg
/opt/homebrew/bin/ffprobe
```

如果你的机器路径不同，以 `which` 输出为准。

## 4. 环境变量

### 4.1 本地 Worker 联调

创建 `transcoder/.dev.vars`：

```env
WORKER_API_BASE_URL=http://127.0.0.1:8787
WORKER_CLAIM_PATH=/api/media/jobs/claim
WORKER_RESULT_PATH_TEMPLATE=/api/items/{itemId}/video-metadata
TRANSCODER_WORKER_ID=mac-mini-01
TRANSCODER_POLL_INTERVAL_MS=5000
TRANSCODER_IDLE_INTERVAL_MS=10000
TRANSCODER_ERROR_INTERVAL_MS=30000
TRANSCODER_TEMP_DIR=.tmp
TRANSCODER_KEEP_WORKDIR=false
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
HLS_TIME_SECONDS=10
THUMBNAIL_OFFSET_SECONDS=1
R2_ACCOUNT_ID=your-account-id
R2_BUCKET_NAME=test
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
```

### 4.2 云端 Worker 联调和日常运行

创建 `transcoder/.env.remote.local`：

```env
WORKER_API_BASE_URL=https://worker.your-subdomain.workers.dev
WORKER_CLAIM_PATH=/api/media/jobs/claim
WORKER_RESULT_PATH_TEMPLATE=/api/items/{itemId}/video-metadata
TRANSCODER_WORKER_ID=mac-mini-01
TRANSCODER_POLL_INTERVAL_MS=5000
TRANSCODER_IDLE_INTERVAL_MS=10000
TRANSCODER_ERROR_INTERVAL_MS=30000
TRANSCODER_TEMP_DIR=.tmp
TRANSCODER_KEEP_WORKDIR=false
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
HLS_TIME_SECONDS=10
THUMBNAIL_OFFSET_SECONDS=1
R2_ACCOUNT_ID=your-account-id
R2_BUCKET_NAME=test
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
```

这两个文件包含密钥，已被 `.gitignore` 忽略，不要提交。

## 5. 临时运行

本地 Worker 联调：

```bash
cd /Volumes/m2_1tb/code/project/netdisk
npm run dev --workspace=transcoder
```

连接云端 Worker：

```bash
cd /Volumes/m2_1tb/code/project/netdisk
npm run dev:remote --workspace=transcoder
```

这适合测试。终端关闭后服务会停止。

## 6. 长期后台运行

长期运行建议使用 macOS `launchd`。

### 6.1 先构建

```bash
cd /Volumes/m2_1tb/code/project/netdisk
npm run build --workspace=transcoder
```

`start:remote` 不会自动构建。代码更新后需要重新执行这条 build 命令。

### 6.2 创建 LaunchAgent

```bash
mkdir -p ~/Library/LaunchAgents
nano ~/Library/LaunchAgents/com.cloudnet.transcoder.plist
```

如果 `which npm` 输出是 `/Users/w/.volta/bin/npm`，可以使用下面配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.cloudnet.transcoder</string>

    <key>WorkingDirectory</key>
    <string>/Volumes/m2_1tb/code/project/netdisk</string>

    <key>ProgramArguments</key>
    <array>
      <string>/Users/w/.volta/bin/npm</string>
      <string>run</string>
      <string>start:remote</string>
      <string>--workspace=transcoder</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/cloudnet-transcoder.out.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/cloudnet-transcoder.err.log</string>
  </dict>
</plist>
```

如果你的 `npm` 路径不同，把 `ProgramArguments` 中的第一项改成 `which npm` 的实际输出。

### 6.3 启动服务

```bash
launchctl load ~/Library/LaunchAgents/com.cloudnet.transcoder.plist
launchctl start com.cloudnet.transcoder
```

### 6.4 查看日志

```bash
tail -f /tmp/cloudnet-transcoder.out.log
tail -f /tmp/cloudnet-transcoder.err.log
```

正常空闲时会看到类似：

```text
[INFO] Transcoder service started
[INFO] No pending media job
```

### 6.5 停止服务

```bash
launchctl stop com.cloudnet.transcoder
launchctl unload ~/Library/LaunchAgents/com.cloudnet.transcoder.plist
```

## 7. 更新代码后的操作

```bash
cd /Volumes/m2_1tb/code/project/netdisk
npm install
npm run build --workspace=transcoder
launchctl stop com.cloudnet.transcoder
launchctl start com.cloudnet.transcoder
```

如果修改了 `.env.remote.local`，也需要重启服务。

## 8. 排查

### 视频一直是 Processing

检查：

- `launchctl` 服务是否正在运行。
- `tail -f /tmp/cloudnet-transcoder.err.log` 是否有报错。
- `.env.remote.local` 中 `WORKER_API_BASE_URL` 是否指向正确 Worker。
- R2 凭据是否正确，且 `R2_BUCKET_NAME` 与 Worker 使用同一个 bucket。
- FFmpeg 是否可用：`ffmpeg -version`、`ffprobe -version`。

### 任务失败

检查 D1 中对应文件的：

- `items.videoStatus`
- `items.videoError`
- `media_jobs.status`
- `media_jobs.errorMessage`

### 想保留临时工作目录

调试时可以设置：

```env
TRANSCODER_KEEP_WORKDIR=true
```

处理完成后临时文件会保留在 `TRANSCODER_TEMP_DIR` 中。调试结束后建议改回 `false`。
