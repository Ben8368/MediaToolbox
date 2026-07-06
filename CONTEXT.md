# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4 已完成，Phase 4.5 浏览器网络能力层第一版已接入，Phase 5 待开始
> **最近更新：** 2026-07-06，继续收口 API 契约债与大文件技术债：兼容下载文件访问改为仅返回任务记录的工作区产物，yt-dlp 产物固定写入 Workspace/Downloads，Browser Network API 与桌面浏览器 IPC 已拆分模型/状态模块，浏览器基础弹窗策略已接入权限审计，API 骨架测试已按 Browser Network 路由拆分；真实桌面体验与生产打包验收后续统一处理。

## 项目定位

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、PSD 模板处理、浏览器辅助和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留 NAS 风格 UI、窗口系统、下载器、文件管理器、转码工作台、PSD 工作台、设置、日志和浏览器入口。
- **桌面壳：** `apps/desktop`，具备 Electron BrowserWindow、托盘、基础 IPC、可选本地 API 子进程启动能力；浏览器 app 通过 `WebContentsView` 由主进程承载真实网页，并已接入 Browser Network session、权限审计和下载事件。
- **API：** `apps/api`，Fastify 本地服务已对齐下载、浏览器网络、文件浏览、系统指标、日志、通知和 jobs 的最小契约。
- **共享包：** `packages/contracts`、`job-core`、`process-manager`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker`、`transcode-worker`、`psd-worker` 已有真实工具入口或可注入执行边界。
- **验证：** `npm run verify` 已通过；浏览器 app 拖拽、缩放已完成用户主观验收。

## 当前阻断项

- 无。

## 剩余黄灯

- 浏览器 app 目前为单窗口 beta 能力；纯 Web 模式仅显示桌面端能力未连接提示。
- Browser Network 第一版已覆盖隔离 session、下载事件、稳定 ID 回写、工作区上传文件选择确认、基础弹窗策略、权限审计和 API/jobs 契约；下载 app 已提供媒体解析/浏览器资源双通道入口；错误页、标签页和生产打包资源加载仍需后续体验验收。
- desktop 已有主进程能力，但 Electron 打包、安装包和生产资源加载仍待后续阶段验收。
- PSD Photoshop adapter 已建立脚本命令边界，PSD 工作台已接入模板检查入口；真实 Photoshop 本机命令路径、复杂 batchPlay 和批量渲染 UI 尚未联调。
- 网络速率已接入浏览器下载增量采样；GPU 指标仍未接入系统级采集器。

## 下一步

1. 验收 Phase 4.5 第一版：桌面浏览器下载真实文件、进度回写、取消、失败提示和权限日志。
2. 统一体验验收：受控上传文件选择、下载 app 双通道、转码工作台真实 ffmpeg 流、PSD 模板检查和生产资源加载。
3. 进入 Phase 5 深水区：PSD 模板 manifest 编辑流、批量渲染 UI、Photoshop 本机命令路径和复杂 batchPlay 联调。
4. 后续接入系统级 GPU 指标和更完整的网络上下行采集器。

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
