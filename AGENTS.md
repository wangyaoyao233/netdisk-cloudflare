# AGENTS.md

本文件定义 Codex 等 AI agent 在本仓库中的工作约束、项目上下文与执行习惯。目标是让 agent 在不破坏现有结构的前提下，稳定地完成开发、修复、重构与文档工作。

## 1. 基本原则

1. 启动后不要主动执行任务，先等待用户指令。
2. 接到任务后，优先理解现有实现，再进行修改，避免基于猜测重写。
3. 所有修改默认遵循最佳实践，优先选择可维护、可验证、与当前技术栈一致的方案。
4. 除非用户明确要求，否则不要做无关重构、不要扩大改动范围、不要修改不相关文件。
5. 不要覆盖或回退用户已有改动；如果发现冲突且无法安全合并，应先暂停并说明原因。

## 2. 项目概览

- 项目类型：基于 Cloudflare 的个人网盘。
- 架构形态：`npm workspaces` monorepo。
- 前端：`frontend/`，使用 React + Vite + TypeScript + Tailwind CSS v4。
- 后端：`worker/`，使用 Cloudflare Worker + TypeScript。
- 转码服务：`transcoder/`，使用 Node.js + TypeScript + FFmpeg，负责本地轮询转码。
- 数据与存储：Cloudflare D1 + R2。
- 文档目录：`docs/`，包含开发日志、部署文档、数据库设计与架构设计。

## 3. 目录约定

- `frontend/`：前端 UI、页面交互、上传下载与文件管理逻辑。
- `worker/`：API、Cloudflare Worker 路由、D1/R2 集成与 HLS 代理。
- `transcoder/`：本地转码服务，负责 claim 任务、下载原片、执行 FFmpeg、上传 HLS 产物并回写 Worker。
- `worker/migrations/`：D1 迁移文件。数据库结构变更必须新增 migration，并同步更新 `worker/schema.sql` 和 `docs/db.md`。
- `docs/daily.md`：开发日志。每次完成用户要求后，都要追加一条记录。
- `docs/db.md`：数据库设计说明。
- `docs/deploy.md`：部署说明。
- `docs/transcoder.md`：本地转码服务运行与后台常驻说明。
- `docs/video-architecture.md`：视频转码与在线播放架构设计。

## 4. 工作流程

1. 先阅读与任务直接相关的文件，再决定修改方案。
2. 修改时优先保持当前架构、命名风格和代码组织方式一致。
3. 完成后进行最小但充分的验证：
   - 前端改动优先运行 `npm run build --workspace=frontend`，必要时补充 `npm run lint --workspace=frontend`。
   - Worker 改动优先运行 `npm run test --workspace=worker`；接口或类型变化时补充 `npx tsc -p worker/tsconfig.json --noEmit`。
   - Transcoder 改动优先运行 `npm run build --workspace=transcoder`；涉及 FFmpeg 处理时尽量用测试视频做本地 smoke test。
   - D1 schema 改动必须新增 `worker/migrations/` 迁移，并说明本地/远程是否已执行。
4. 如果因为环境、凭据、云服务依赖导致无法验证，需要明确说明未验证项及原因。
5. 每次任务完成后，将本次改动写入 `docs/daily.md`。

## 5. daily.md 记录规范

每次完成任务后，按以下格式追加记录：

```md
## YYYY-MM-dd {Summary}
### 背景

### 目标

### 采用的修改

### 结果

### 本次的最佳实践总结

### TODO(如果需要的话，一些将来可以做的事情)
```

要求：

- `Summary` 用一句话概括本次工作。
- 内容聚焦“为什么改、改了什么、结果如何、后续还能做什么”。
- “最佳实践总结”应提炼为可复用的工程经验，而不是简单重复修改内容。

## 6. 本仓库推荐命令

在仓库根目录执行：

```bash
npm install
npm run dev
npm run dev:remote
npm run build
npm run build:transcoder
npm run deploy:worker
```

按工作区执行：

```bash
npm run dev --workspace=frontend
npm run build --workspace=frontend
npm run lint --workspace=frontend

npm run dev --workspace=worker
npm run test --workspace=worker
npm run deploy --workspace=worker

npm run dev --workspace=transcoder
npm run dev:remote --workspace=transcoder
npm run build --workspace=transcoder
```

本地 D1 初始化或迁移示例：

```bash
npx wrangler d1 execute netdisk-db --local --file=schema.sql
npx wrangler d1 migrations apply netdisk-db --local
npx wrangler d1 migrations apply netdisk-db --remote
npx wrangler d1 execute netdisk-db --local --file=seed.sql
```

## 7. 代码与设计约束

### 前端

- 优先沿用 React + TypeScript 现有模式。
- 保持组件职责清晰，避免把 API、状态管理和视图渲染过度耦合。
- Tailwind 样式应以可读、可维护为前提，不堆砌无语义类名。
- 任何影响上传、下载、列表刷新、导航的改动，都应考虑移动端与异常态。
- 视频播放相关改动需要考虑 `pending`、`processing`、`completed`、`failed` 四种状态，以及 Safari 原生 HLS 与 `hls.js` 动态加载路径。

### Worker

- 优先使用 Cloudflare Worker 原生能力与平台推荐方式。
- 涉及 R2、D1 的逻辑时，注意数据一致性、幂等性与错误处理。
- 对外接口变更时，需要同步检查前端类型与调用链。
- 涉及签名 URL、鉴权、删除、写入等关键路径时，优先保证安全性与可追踪性。
- 涉及 D1 表结构时，必须通过 migration 演进，不能只修改 `schema.sql`。
- HLS playlist 和 segment 由 Worker 代理读取 R2，不应让前端直接依赖真实 R2 对象路径。

### Transcoder

- 优先保持其作为独立 Node.js workspace 的边界，不把 FFmpeg 逻辑耦合进 Worker 或前端。
- 环境变量模板使用 `.env.example`，真实本地配置使用 `.dev.vars` 或 `.env.remote.local`，不得提交密钥。
- 涉及 R2 路径、Worker claim/result 接口或视频元数据字段时，必须同步检查 `docs/video-architecture.md`、`docs/db.md` 和前端类型。
- FFmpeg 处理失败时应能回写 `failed` 状态，避免任务永久卡在 `processing`。

### 通用

- 优先做小步、明确、可验证的改动。
- 新增代码应服务当前需求，避免为假设中的未来需求做过度设计。
- 如果要引入新依赖，应先确认现有栈无法合理解决，并说明原因。
- 文档、接口、类型定义、实现逻辑应保持同步。
- 删除或重命名文档时，需要同步检查 README、AGENTS 和相关 docs 中的引用。

## 8. 禁止事项

- 不要在没有明确需求的情况下大规模重构。
- 不要擅自修改部署配置、云端资源命名、密钥约定。
- 不要提交虚假的“已验证”结论。
- 不要忽略错误处理、边界条件和失败回滚路径。
- 不要擅自修改格式，比如空格，逗号，句号等，除非有明确修改格式的需求。

## 9. 输出要求

- 回答问题时尽量简洁、准确、可执行。
- 如果做了代码修改，需要说明：
  - 改了什么；
  - 为什么这么改；
  - 如何验证；
  - 是否有遗留风险或后续建议。
- 如果任务涉及多文件协同，优先从整体行为变化说明，而不是逐文件罗列。

## 10. 决策优先级

当多条规则冲突时，按以下优先级处理：

1. 用户当前明确指令。
2. 安全性、数据正确性、可恢复性。
3. 与现有架构和技术栈保持一致。
4. 最佳实践与可维护性。
5. 开发效率。

如果用户指令与本文件冲突，以用户指令为准；但应在执行前明确指出潜在风险。
