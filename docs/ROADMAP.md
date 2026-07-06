# Roadmap

阶段计划和 Feature 索引放在这里，避免污染每轮必读的 `CONTEXT.md`。

## Phase 1：前端基线迁回

状态：**完成**。

- 从远端迁回 NAS 风格 Web 桌面前端。
- 迁入位置：`apps/web`。
- 保留桌面壳、窗口系统、应用注册、下载器、文件管理器、设置、日志和静态视觉资产。
- 保留治理文档体系和红绿灯审查机制。

## Phase 2：大项目骨架

状态：**完成**。

- [x] 建立 npm workspaces monorepo。
- [x] 建立 `apps/api` Fastify 本地 API 骨架。
- [x] 建立 `apps/desktop` Electron 桌面壳骨架。
- [x] 建立 contracts、job-core、downloader、ffmpeg、psd-core、media-core、db、ui 共享包。
- [x] 建立 download/transcode/psd worker 入口。
- [x] 安装依赖并生成根 lockfile。
- [x] 跑通 workspace `npm run verify`。
- [x] 将前端 API 契约迁移到 `packages/contracts`，并补齐 `apps/api` 可联调骨架端点。

## Phase 3：真实下载与转码

状态：**完成**。

- [x] 接入 `yt-dlp` adapter 与 download worker 执行入口。
- [x] 接入下载任务进度解析、取消、失败重试和历史记录。
- [x] 接入 `ffprobe` 媒体探测。
- [x] 接入 `ffmpeg` 转码预设。
- [x] 下载多 URL 提交拆分为多任务和多 jobs。
- [ ] 前端下载工作台对接本地 API（需 Phase 4 持久化完成后再验收）。

## Phase 4：文件库与任务中心

状态：**完成**。

- [x] SQLite 持久化资产、任务和日志。
- [x] 文件浏览接入受控本地工作区映射。
- [x] 日志清理、通知已读和统一 jobs cancel 接入真实状态更新。
- [x] 系统指标接入 uptime、CPU 负载近似值和内存占用采样。
- [x] 文件库接入资产索引，统一显示浏览器下载和转码产出。
- [x] 全局任务中心显示下载、浏览器下载、转码/PSD jobs 的状态、进度和失败原因，并统一走 jobs cancel。
- [x] 前端转码工作台接入真实 `/api/transcode/jobs` 和统一 jobs 取消/轮询链路。

## Phase 4.5：浏览器网络能力层

状态：**非验收类能力已接入，待桌面端统一体验验收**。

目标：把现有真浏览器 app 沉淀为可复用的 Browser Network adapter，让下载、文件管理和后续新增 app 可以按浏览器网络行为执行受控上传下载，同时保留 worker adapter 处理媒体解析和后处理。

- [x] 在 `apps/desktop` 建立 browser session 管理边界，区分默认会话和应用隔离会话。
- [x] 接管 Electron 下载事件，支持下载目标目录、文件名冲突、进度、取消、失败原因和完成通知。
- [x] 建立受控文件选择 / 上传桥接，上传来源仅允许工作区内文件，并要求用户确认；网页 File System Access 权限仍默认拒绝并写入权限审计。
- [x] 在 `apps/api` 冻结 Browser Network 任务契约，纳入统一 jobs、日志、权限校验和工作区路径约束。
- [x] 下载 app 增加双通道策略：普通网页资源走浏览器下载；视频、音频、字幕和后处理继续走 `yt-dlp` / worker。
- [x] 定义权限策略：下载、上传、弹窗、剪贴板、通知、跨域读取和 cookie 访问分别授权，默认不向 Web UI 暴露原始 cookie。
- [x] 补齐浏览器 app 的基础弹窗策略：支持的弹窗 URL 收敛到受控当前视图，不支持的弹窗给出可见错误并写入权限审计。
- [ ] 补齐浏览器 app 的错误页、标签页和生产打包资源加载验收。

## Phase 5：PS / PSD 工作台

状态：**第一版工作台已接入，待 Photoshop 本机联调与批量渲染 UI**。

- 定义 PSD template manifest。
- 支持 slot 检查、文案替换、底图替换、尺寸变体和批量导出。
- [x] 建立 Photoshop JSX adapter 与可配置命令 runner。
- [x] 前端 PSD 工作台接入模板检查入口，Photoshop 未配置时返回可读错误。
- [ ] 复杂 PSD 接 Photoshop 本机联调；优先 DOM，复杂命令再 batchPlay。

## Feature 索引

| Feature | 主题 | 状态 |
| --- | --- | --- |
| 001 | NAS 风格前端迁回 | 完成 |
| 002 | 应用注册与多窗口系统 | 完成 |
| 003 | 下载器 UI | 完成 |
| 004 | 文件管理器 UI | 完成 |
| 005 | 治理文档与红绿灯审查 | 完成 |
| 006 | monorepo 大项目骨架 | 完成 |
| 007 | 本地 API 服务 | 本地能力部分接入 |
| 008 | Electron 桌面壳 | BrowserWindow / IPC / 托盘已接入 |
| 009 | 任务状态机 | jobs cancel 已联动 |
| 010 | yt-dlp adapter | 执行入口已接入 |
| 011 | ffmpeg adapter | 执行入口已接入，转码工作台 beta 已对接真实 API |
| 012 | PSD 模版引擎 | engine 接口、Photoshop JSX adapter 与 PSD 检查工作台已建立 |
| 013 | 真浏览器 app | 单窗口 beta 已接入，拖拽和缩放已主观验收 |
| 014 | Browser Network adapter | 非验收类能力已接入：隔离 session、下载事件、受控上传选择、权限审计、API/jobs 契约 |
