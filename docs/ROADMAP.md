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
- [ ] 将前端 API 契约迁移到 `packages/contracts`。

## Phase 3：真实下载与转码

状态：**待开始**。

- 接入 `yt-dlp` 执行器。
- 接入下载任务进度解析、取消、失败重试和历史记录。
- 接入 `ffprobe` 媒体探测。
- 接入 `ffmpeg` 转码预设。
- 前端下载工作台对接本地 API。

## Phase 4：文件库与任务中心

状态：**待开始**。

- SQLite 持久化资产、任务和日志。
- 文件库统一管理下载、转码和 PSD 产出。
- 全局任务中心显示 worker 状态、进度、日志和失败原因。

## Phase 5：PS / PSD 工作台

状态：**待开始**。

- 定义 PSD template manifest。
- 支持 slot 检查、文案替换、底图替换、尺寸变体和批量导出。
- 复杂 PSD 接 Photoshop 自动化 adapter；优先 DOM，复杂命令再 batchPlay。

## Feature 索引

| Feature | 主题 | 状态 |
| --- | --- | --- |
| 001 | NAS 风格前端迁回 | 完成 |
| 002 | 应用注册与多窗口系统 | 完成 |
| 003 | 下载器 UI | 完成 |
| 004 | 文件管理器 UI | 完成 |
| 005 | 治理文档与红绿灯审查 | 完成 |
| 006 | monorepo 大项目骨架 | 进行中 |
| 007 | 本地 API 服务 | 骨架 |
| 008 | Electron 桌面壳 | 骨架 |
| 009 | 任务状态机 | 骨架 |
| 010 | yt-dlp adapter | 骨架 |
| 011 | ffmpeg adapter | 骨架 |
| 012 | PSD 模版引擎 | 骨架 |
