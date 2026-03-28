# CloudNet: 基于 Cloudflare 全栈架构的个人网盘

CloudNet 是一个利用 Cloudflare 现代开发者平台构建的轻量级个人网盘系统。本项目采用 Monorepo 架构，实现了文件的高效上传、下载及目录管理。

## 🌟 核心特性

- **高性能存储**：直接利用 Cloudflare R2 对象存储，通过 **S3 预签名 URL** 方案，让前端直接与存储桶通信，绕过 Worker 限制。
- **轻量级 API**：后端基于 Cloudflare Worker 实现，极致的冷启动速度与低延迟。
- **结构化元数据**：使用 Cloudflare D1 (SQLite) 存储文件目录树及元数据，支持复杂的目录层级查询。
- **现代 UI**：前端采用 React + Tailwind CSS v4 构建，支持拖拽上传、面包屑导航及移动端适配。

## 🏗️ 项目架构

项目采用 `npm workspaces` 进行管理：

- `/frontend`: React + Vite 前端应用。
- `/worker`: Cloudflare Worker 后端 API 服务。
- `/docs`: 开发日志与数据库设计方案。

## 🚀 快速启动

### 1. 克隆并安装
```bash
git clone <your-repo-url>
cd netdisk
npm install
```

### 2. 配置后端 (Worker)
进入 `worker` 目录：
1. **初始化数据库**：
   ```bash
   npx wrangler d1 execute netdisk-db --local --file=schema.sql
   ```
2. **填充测试数据** (可选)：
   ```bash
   npx wrangler d1 execute netdisk-db --local --file=seed.sql
   ```
3. **配置本地密钥**：
   在 `worker/` 下创建 `.dev.vars` 并填入你的 R2 凭据：
   ```env
   R2_ACCOUNT_ID=你的账号ID
   R2_ACCESS_KEY_ID=你的R2访问ID
   R2_SECRET_ACCESS_KEY=你的R2访问密钥
   BUCKET_NAME=test
   ```

### 3. 运行开发环境
在项目根目录下执行：
```bash
npm run dev
```
前端将在 `http://localhost:5173` 启动，后端将在 `http://localhost:8787` 运行。

## 🛠️ 技术栈

- **Frontend**: React, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Cloudflare Worker (Native Fetch API)
- **Database**: Cloudflare D1 (SQL)
- **Storage**: Cloudflare R2 (S3 Compatible)

## 📄 开源协议
ISC License
