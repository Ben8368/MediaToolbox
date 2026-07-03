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
- [ ] 文件库统一管理下载、转码和 PSD 产出（UI 联调待后续）。
- [ ] 全局任务中心显示 worker 状态、进度、日志和失败原因（UI 联调待后续）。

## Phase 5：PS / PSD 工作台

状态：**待开始**。

- 定义 PSD template manifest。
- 支持 slot 检查、文案替换、底图替换、尺寸变体和批量导出。
- [x] 建立 Photoshop JSX adapter 与可配置命令 runner。
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
| 011 | ffmpeg adapter | 执行入口已接入 |
| 012 | PSD 模版引擎 | engine 接口与 Photoshop JSX adapter 已建立 |
