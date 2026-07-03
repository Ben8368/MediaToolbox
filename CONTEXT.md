# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 1 前端迁回完成 → Phase 2 大项目骨架已搭好
> **最近更新：** 2026-07-02，远端 NAS 风格前端迁入 `apps/web`，monorepo 骨架完成并通过 `npm run verify`

## 项目定位

MediaToolbox 是一个 NAS 风格桌面 Web 前端加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、PSD 模版处理和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留远端已验收的 NAS 风格 UI、窗口系统、下载器、文件管理器、设置和日志入口。
- **API：** `apps/api`，Fastify 本地服务骨架，当前只提供健康检查和应用列表示例。
- **桌面壳：** `apps/desktop`，Electron 配置入口骨架。
- **共享包：** `packages/contracts`、`job-core`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker`、`transcode-worker`、`psd-worker` 已建立入口。
- **治理：** 保留红绿灯审查机制，规则见 `docs/AI_RULES.md`。
- **验证：** `npm run verify` 已通过，覆盖测试、typecheck 和 build。

## 当前阻断项

- 无。

## 剩余黄灯

- `apps/web` 仍保留历史 `fnos-*` CSS 类名前缀；仅作为实现细节，不进入用户文案。
- `apps/web/src/api/` 仍是迁回前端的 HTTP 契约，需要逐步对齐本地 `apps/api`。
- API、desktop、workers 目前是架构骨架，尚未接真实执行器、数据库和任务队列。

## 下一步

1. 将前端下载器 API 契约对齐 `packages/contracts` 和 `apps/api`。
2. 为任务中心接入 `packages/job-core` 的状态机。
3. 实现下载 worker 的 `yt-dlp` 进程执行、进度解析和取消。
4. 接入 SQLite 持久化任务、资产和日志。
5. 增加 PS 工作台入口和 PSD template manifest UI。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev:web` | 启动前端开发服务器 |
| `npm run dev:api` | 启动本地 API 服务 |
| `npm run dev:desktop` | 启动桌面壳开发入口 |
| `npm run typecheck` | workspace 类型检查 |
| `npm run test` | workspace 测试 |
| `npm run verify` | 客观验证 |

## 常用文档

- 治理规则：`AGENTS.md`
- 架构说明：`docs/ARCHITECTURE.md`
- 错题索引：`LESSONS.md`
- 审查规格：`docs/AI_RULES.md`
- API 契约：`docs/FRONTEND_API_CONTRACT.md`
- API 联调：`docs/API_VALIDATION.md`
- UI 兼容：`docs/UI_COMPAT.md`
- 路线图：`docs/ROADMAP.md`
