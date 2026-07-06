# yt-dlp 能力边界

## 结论

- 下载器默认采用智能路由：`yt-dlp` 优先，Browser Network 后备。
- `yt-dlp` 优先处理视频、音频、字幕、播放列表、直播和媒体元数据等媒体解析场景。
- Browser Network 优先处理静态文件、图片、登录态网页下载、跳转链下载和需要真实 Chromium session 的后备场景。
- 是否支持某个站点不能只靠硬编码平台名判断；`yt-dlp` 官方说明也要求以实际 extractor 试解析为准。

## 官方依据

`yt-dlp` 官方 `supportedsites.md` 维护当前内置 extractor 列表。该说明明确：

- 未列出的站点也可能通过 embed extraction 或 generic extractor 支持。
- 已列出的站点也不保证永远可用，因为网站会变化。
- 唯一可靠检查方式是尝试解析。

## 项目策略

1. 前端默认 `auto` 通道先调用 `POST /api/downloads/analyze`。
2. API 对静态图片、文档和压缩包 URL 建议 Browser Network。
3. 其余 URL 先交给 `yt-dlp` / download worker。
4. Browser Network 的 GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS 请求由 Electron 主进程使用 Chromium session 承载。
5. Web UI 不允许直接注入 `cookie`、`user-agent`、`sec-*`、`host`、`origin`、`referer` 等浏览器敏感头，避免把真实浏览器态暴露给前端。

