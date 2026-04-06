# 部署指南 (Deployment Guide)

本项目基于 Cloudflare 生态系统构建，包含前端 (Cloudflare Pages) 和后端 (Cloudflare Workers)。

## 1. 准备工作

在开始部署之前，请确保您已完成以下准备：

1.  **Cloudflare 账号**：拥有一个活跃的 Cloudflare 账号。
2.  **Node.js 环境**：本地已安装 Node.js (建议 v18+)。
3.  **Wrangler CLI**：通过 `npm install -g wrangler` 安装 Cloudflare 开发工具。
4.  **登录 Cloudflare**：在终端运行 `wrangler login` 并完成授权。

---

## 2. 后端部署 (Cloudflare Workers)

后端代码位于 `worker/` 目录。

### 2.1 创建 D1 数据库
运行以下命令创建一个新的 D1 数据库：
```bash
npx wrangler d1 create netdisk-db
```
创建成功后，控制台会输出 `database_id`。请将其更新到 `worker/wrangler.jsonc` 中的 `database_id` 字段。

### 2.2 初始化数据库结构
使用项目提供的 `schema.sql` 初始化数据库：
```bash
# 本地测试环境
npx wrangler d1 execute netdisk-db --local --file=./schema.sql

# 生产环境
npx wrangler d1 execute netdisk-db --remote --file=./schema.sql
```

### 2.3 创建 R2 存储桶
运行以下命令创建一个新的 R2 Bucket：
```bash
npx wrangler r2 bucket create netdisk-files
```
更新 `worker/wrangler.jsonc` 中的 `bucket_name` 为 `netdisk-files`。

### 2.4 部署 Worker
在 `worker/` 目录下执行：
```bash
npm run deploy
```
或者在项目根目录执行：
```bash
npm run deploy:worker
```

---

## 3. 前端部署 (Cloudflare Pages)

前端代码位于 `frontend/` 目录，使用 Vite 构建。

### 3.1 方案 A：通过控制台手动部署
1.  进入 Cloudflare 控制台 -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
2.  选择你的代码仓库。
3.  设置构建配置：
    *   **Framework preset**: `Vite`
    *   **Build command**: `npm run build`
    *   **Build output directory**: `dist`
    *   **Root directory**: `frontend`
4.  点击 **Save and Deploy**。

### 3.2 方案 B：通过 Wrangler 命令行部署
在 `frontend/` 目录下执行：
```bash
# 首先构建项目
npm run build

# 部署到 Pages
npx wrangler pages deploy dist --project-name=netdisk-frontend
```

---

## 4. 环境变量配置

### 后端 (Worker)
如果需要配置敏感信息（如 API Key），请使用 `wrangler secret`：
```bash
npx wrangler secret put MY_SECRET_KEY
```

### 前端 (Pages)
在 Cloudflare Pages 控制台中，设置以下环境变量：
*   `VITE_API_BASE_URL`: 指向你部署后的 Worker 域名。
    *   **重要格式要求**：必须包含协议头 `https://` 且推荐包含 `/api` 后缀。
    *   **正确示例**：`https://worker.your-subdomain.workers.dev/api`
    *   **错误示例**：`worker.your-subdomain.workers.dev` (会导致路径拼接错误)

---

## 5. CI/CD 自动化部署

为了实现自动化部署，推荐以下方案：

### 5.1 前端 (Cloudflare Pages)
进入 Cloudflare 控制台，将 Pages 项目关联到你的 GitHub 仓库。**Cloudflare 会自动监听 `main` 分支的 Push 并自动构建部署**，无需额外配置。

### 5.2 后端 (GitHub Actions)
项目已包含 `.github/workflows/deploy.yml`。按照以下步骤启用：

#### 第一步：在 Cloudflare 生成 API Token
1.  **登录 Cloudflare 控制台**：访问 [dash.cloudflare.com](https://dash.cloudflare.com/)。
2.  **进入 API 令牌页面**：点击右上角的人头像图标 -> **My Profile (我的个人资料)** -> 左侧菜单选择 **API Tokens (API 令牌)**。
3.  **创建令牌**：点击 **Create Token (创建令牌)** 按钮。
4.  **配置权限**（请确保包含以下 **5 个权限**，缺一不可）：
    *   **Account** | **Workers Scripts** | **Edit** (部署 Worker 代码)
    *   **Account** | **Cloudflare R2 Storage** | **Edit** (操作 R2 存储桶)
    *   **Account** | **D1** | **Edit** (操作 D1 数据库)
    *   **Account** | **Account Settings** | **Read** (辅助 Wrangler 识别账户)
    *   **User** | **User Details** | **Read** (获取用户信息)
5.  **资源范围 (Account Resources)**：选择 `Include | All accounts`。
6.  **区域范围 (Zone Resources)**：选择 `Include | All zones`。
7.  **生成并复制**：点击 **Continue to summary** -> **Create Token**。
8.  **保存 Token**：**请立即复制并安全保存**，关闭页面后将无法再次查看。

#### 第二步：在 GitHub 仓库中设置 Secret
1.  **进入 GitHub 仓库**：在浏览器中打开你的项目 GitHub 页面。
2.  **进入 Settings**：点击顶部的 **Settings (设置)** 选项卡。
3.  **找到 Secrets 菜单**：在左侧侧边栏中，点击 **Secrets and variables** -> **Actions**。
4.  **新建 Secret**：点击 **New repository secret** 按钮。
5.  **填写信息**：
    *   **Name (名称)**：填入 `CLOUDFLARE_API_TOKEN`（需与 `deploy.yml` 一致）。
    *   **Secret (值)**：粘贴你刚才在 Cloudflare 生成的 Token。
6.  **保存**：点击 **Add secret**。

#### 第三步：触发部署
*   **代码触发**：每当你提交代码并推送到 `main` 分支，且 `worker/` 目录有变动时，GitHub Actions 会自动部署后端。
*   **手动触发**：在 GitHub 仓库的 **Actions** 选项卡下，选择 **Deploy Worker** 工作流并点击 **Run workflow**。

---

## 6. 常见问题 (FAQ)

*   **跨域问题 (CORS)**：确保 Worker 代码中正确处理了来自 Pages 域名的 CORS 请求。
*   **数据库迁移**：每次修改 `schema.sql` 后，记得运行 `wrangler d1 execute` 同步到生产环境。
