# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `codex/browser-app`
> **当前阶段：** Phase 4 已完成，Phase 5 待开始
> **最近更新：** 2026-07-03，新增真浏览器版桌面 app；Web 侧注册“浏览器”入口，Electron 侧通过 preload 限定桥接与 `WebContentsView` 承载网页内容；用户已验收拖拽、缩放体验。

## 项目定位

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、PSD 模板处理、浏览器辅助和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留 NAS 风格 UI、窗口系统、下载器、文件管理器、设置、日志和浏览器入口。
- **桌面壳：** `apps/desktop`，具备 Electron BrowserWindow、托盘、基础 IPC、可选本地 API 子进程启动能力；浏览器 app 通过 `WebContentsView` 由主进程承载真实网页。
- **API：** `apps/api`，Fastify 本地服务已对齐下载、文件浏览、系统指标、日志、通知和 jobs 的最小契约。
- **共享包：** `packages/contracts`、`job-core`、`process-manager`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker`、`transcode-worker`、`psd-worker` 已有真实工具入口或可注入执行边界。
- **验证：** `npm run verify` 已通过；浏览器 app 拖拽、缩放已完成用户主观验收。

## 当前阻断项

- 无。

## 剩余黄灯

- 浏览器 app 目前为单窗口 beta 能力；纯 Web 模式仅显示桌面端能力未连接提示。
- 浏览器下载处理、权限策略、弹窗策略、标签页和生产打包资源加载仍需后续验收。
- desktop 已有主进程能力，但 Electron 打包、安装包和生产资源加载仍待后续阶段验收。
- PSD Photoshop adapter 已建立脚本命令边界，但真实 Photoshop 本机命令路径、复杂 batchPlay 和 PSD 工作台 UI 尚未联调。
- 网络速率、GPU 指标仍未接入系统级采集器；当前系统指标主要覆盖 uptime、CPU 负载近似值和内存占用。

## 下一步

1. 继续验收浏览器 app 的导航、层级、错误页和生产打包资源加载。
2. 前端转码工作台实际对接真实转码流。
3. 进入 Phase 5：设计 PSD 工作台 UI、PSD 模板 manifest 编辑流和 Photoshop 本机联调清单。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 通过 supervisor 统一启动前端开发服务器和本地 API |
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
