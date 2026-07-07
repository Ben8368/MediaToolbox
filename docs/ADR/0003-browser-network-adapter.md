# ADR 0003: Browser Network adapter

- 状态：已接受
- 日期：2026-07-07

## 背景

部分下载和上传场景依赖真实浏览器行为，例如网页登录态、跳转链、Chromium 下载事件和用户手势。让 Web UI 直接接触 cookie、session 或本地文件会破坏安全边界。

## 决策

- 浏览器 app 由 Electron `WebContentsView` 承载真实网页。
- Electron 主进程持有 Chromium session、权限策略、下载事件、弹窗策略和文件选择桥接。
- Web UI 只表达用户意图并展示状态。
- Browser Network 下载登记为统一 job，写入受控工作区。
- 受控上传只能选择工作区内文件，并在桌面端确认。
- 默认不向 Web UI 暴露原始 cookie、session 或本地敏感路径。
- 媒体解析、字幕提取、格式选择和后处理继续走 `yt-dlp` / worker adapter。

## 后果

好处：

- 浏览器能力可复用，且不污染普通前端边界。
- 下载、权限和日志能纳入统一任务系统。
- 登录态相关能力留在 Electron 主进程。

代价：

- 多标签页 view 生命周期和下载事件归属需要真机验收。
- 纯 Web 模式需要降级体验。
- Electron 打包会影响 preload、API 运行时和 session 存储路径。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/API_VALIDATION.md`
- `docs/TECH_DEBT.md`

