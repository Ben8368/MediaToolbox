# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4.5 浏览器错误页、生产资源路径与多标签页前端 UI 已接入，Phase 5 PSD 工作台核心能力（渲染 API、manifest 编辑、批量渲染、manifest 持久化）已接入
> **最近更新：** 2026-07-06，浏览器 app 接入多标签页前端 UI：新增 `apps/web/src/apps/browser/`（`helpers.ts` 纯函数 + reducer、`useBrowserTabs.ts` 多 `viewId` 生命周期与事件路由 hook、`BrowserTabBar.tsx` 标签栏），`BrowserApp.tsx` 由 360 行瘦身到 162 行；每个标签独立地址/状态，活动标签独占原生 WebContentsView，切换时隐藏旧 view，关闭销毁 view 且拒绝关最后一个标签，下载/权限/上传事件按窗口聚合到侧栏。桌面端 IPC/session 层（`browserViews.ts` 按 `id` 键 Map）本就支持多 view，无需改动。此前已完成：浏览器错误态 overlay 错误文案与重试按钮；`apps/web` Vite `base: './'` 修复 `file://` 资源路径；PSD 渲染 API `POST /api/psd/render`、manifest 编辑/批量渲染标签页、manifest JSON sidecar 持久化，且渲染输出路径经工作区收口。真实 Photoshop 联调、多标签页桌面端真机验收与 Electron 生产打包仍待后续。

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
- Browser Network 第一版已覆盖隔离 session、下载事件、稳定 ID 回写、工作区上传文件选择确认、基础弹窗策略、权限审计和 API/jobs 契约；下载 app 已提供媒体解析/浏览器资源双通道入口；错误页 UI 已收口（overlay 显示错误文案与重试按钮）；多标签页 UI 前端已接入（`useBrowserTabs` 管理多 viewId、独立地址/状态、活动标签独占原生 view），但标签切换隐藏旧 view、view 生命周期与多标签下载体验仍待桌面端真机验收；网络事件目前按窗口聚合而非按标签隔离。
- desktop 已有主进程能力；`apps/web` 构建已加 `base: './'` 支持 `file://` 加载，但 Electron 打包工具链（electron-builder/forge）、preload 生产路径和本地 API 生产运行时（当前依赖 `tsx` + 源码）仍待后续阶段验收。
- PSD Photoshop adapter 已建立脚本命令边界；PSD 工作台已接入模板检查、manifest 编辑、批量渲染（仅文字 slot）和 manifest JSON sidecar 持久化；渲染输出路径已收口在工作区内（服务端受控生成、剥离客户端 `__` 保留键）；真实 Photoshop 本机命令路径、复杂 batchPlay 和 image/smart-object slot 渲染尚未联调。
- 网络速率已接入浏览器下载增量采样；GPU 指标仍未接入系统级采集器。

## 下一步

1. 验收 Phase 4.5：桌面浏览器下载真实文件、进度回写、取消、失败提示、权限日志和新增错误页重试路径。
2. PSD 工作台端到端联调：配置真实 Photoshop 命令，验证 `POST /api/psd/render` 输出正确 PNG，验证 manifest 保存/加载往返。
3. 进入 Phase 5 深水区：image/smart-object slot 渲染实现、复杂 batchPlay 联调。
4. 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），并补齐 Electron 生产打包工具链（electron-builder/forge、preload 与 API 运行时打包）。
5. 后续接入系统级 GPU 指标和更完整的网络上下行采集器。

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
