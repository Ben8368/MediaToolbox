# Architecture

MediaToolbox 采用桌面壳、Web UI、本地 API、任务系统、worker 和 adapter 分层。目标是保持小巧，但边界按长期项目设计。

## 分层

```text
apps/desktop  Electron 桌面壳，负责窗口、托盘、启动本地服务
apps/web      NAS 风格 React 前端，负责展示与交互
apps/api      本地 HTTP API，负责鉴权边界、任务编排、资产访问
workers/*     下载、转码、PSD 批处理等可隔离执行单元
packages/*    共享契约、状态机、adapter、数据库和 UI 工具
```

## 关键原则

- UI 不直接执行 `yt-dlp`、`ffmpeg`、Photoshop 或文件系统危险操作。
- API 只编排任务和管理本地资源，重活交给 worker。
- 第三方工具必须通过 adapter 包装，命令参数构建与进程执行分开。
- 所有长任务进入统一 Job 模型，支持进度、日志、取消、失败重试和恢复。
- PSD 能力以模版 manifest 为中心，高保真编辑通过 Photoshop adapter 实现。
- 浏览器网络能力由 Electron 主进程承载，其他 app 只能通过受控 API / IPC 调用，不直接读取 cookie、session 或本地文件。

## 浏览器网络能力

浏览器 app 使用 Electron `WebContentsView` 承载真实网页，并通过 Browser Network adapter 提供可复用的浏览器网络能力基础。该能力用于处理需要网页登录态、跳转链、浏览器下载事件或用户手势的上传下载场景。

边界约定：

- `apps/desktop` 持有 Chromium session、权限策略、下载事件、弹窗策略和文件选择桥接；当前第一版已接管隔离 session、下载事件和默认拒绝的权限审计。
- `apps/api` 负责任务创建、权限校验、工作区路径约束、日志和统一 Job 状态；浏览器下载登记为 `browser.download` job。
- `apps/web` 只提交用户意图并展示状态，例如“使用当前浏览器会话下载”“上传工作区文件到当前页面”。
- 下载 app 后续采用双通道：普通浏览器下载走 Browser Network adapter；媒体解析、字幕提取、格式选择和后处理继续走 `yt-dlp` / worker adapter。
- 所有下载写入受控工作区；所有上传来源必须经过工作区路径校验和用户确认。

## Workbench Apps

首批应用：

- 文件管理：资产浏览、预览、目录选择和回收站。
- 下载：视频、音频、字幕下载底层封装 `yt-dlp`；普通网页资源下载接入 Browser Network adapter 后再汇入下载 app 双通道策略。
- 转码：按预设调用 `ffmpeg`。
- PS：PSD 模版检查、slot 替换、批量导出，复杂场景接 Photoshop 自动化。
- 任务中心：统一任务队列、日志和历史。

## 数据模型

- `AssetRecord`：视频、音频、字幕、图片、PSD、文件夹和导出结果。
- `JobRecord`：下载、转码、PSD 批处理等长任务。
- `PsdTemplateManifest`：PSD 模版、图层 slot、画布和导出约束。

共享类型位于 `packages/contracts`，任务状态机位于 `packages/job-core`。
