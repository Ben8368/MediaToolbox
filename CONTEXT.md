# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4 已完成，Phase 5 待开始
> **最近更新：** 2026-07-03，继续处理剩余黄灯：desktop 增加 BrowserWindow、托盘、IPC 与可选本地 API 子进程；系统指标接入 Node 运行时采样；日志清理、通知已读和 jobs cancel 改为真实状态更新；`psd-core` 增加 Photoshop JSX adapter 与命令 runner，`psd-worker` 支持环境变量接入。

## 项目定位

MediaToolbox 是一个 NAS 风格桌面 Web 前端加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、PSD 模版处理和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留远端已验收的 NAS 风格 UI、窗口系统、下载器、文件管理器、设置和日志入口。
- **API：** `apps/api`，Fastify 本地服务已对齐前端下载、文件浏览、系统指标、日志、通知和 jobs 的最小契约；路由已按领域拆分，并对关键写入端点加入基础 schema、虚拟工作区路径边界、受控本地工作区映射、日志清理、通知已读和统一任务取消。
- **桌面壳：** `apps/desktop`，已具备 Electron BrowserWindow、托盘、基础 IPC 和可选本地 API 子进程启动能力；开发环境默认不抢占已有 API 端口。
- **共享包：** `packages/contracts`、`job-core`、`process-manager`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker` 已接入 `yt-dlp` 工具解析与真实执行入口；`transcode-worker` 已接入 `ffmpeg`/`ffprobe` 执行入口；`psd-worker` 已具备可注入 PSD engine 的 inspect/render 入口，并可通过 `MEDIATOOLBOX_PHOTOSHOP_COMMAND` 接入 Photoshop adapter。
- **治理：** 保留红绿灯审查机制，规则见 `docs/AI_RULES.md`。
- **验证：** `npm run verify` 已通过，覆盖测试、typecheck 和 build。

## 当前阻断项

- 无。

## 剩余黄灯

- desktop 已有主进程能力，但 Electron 打包、安装包和生产资源加载仍待后续阶段验收。
- PSD Photoshop adapter 已建立脚本/命令边界，但真实 Photoshop 本机命令路径、复杂 batchPlay 和 PSD 工作台 UI 尚未联调。
- 网络速率、GPU 指标仍未接入系统级采集器；当前系统指标只覆盖 uptime、CPU 负载近似值和内存占用。

## 下一步

1. 前端转码工作台实际对接真实转码流（手动验证）。
2. 进入 Phase 5：设计 PSD 工作台 UI、PSD 模版 manifest 编辑流和 Photoshop 本机联调清单。
3. 补充网络速率/GPU 指标采集器与桌面生产打包配置。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 通过 supervisor 统一启动前端开发服务器和本地 API，并支持关闭按钮联动退出 |
| `npm run dev:web` | 单独启动前端开发服务器 |
| `npm run dev:api` | 单独启动本地 API 服务 |
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
