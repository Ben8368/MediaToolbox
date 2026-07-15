# 发布流程

本文定义发布前的工程检查。当前项目尚未进入稳定公开发布阶段；Electron 打包态 renderer / API / 静态资源链路及自动化烟测已接入，TD-019 剩余首次三平台 tag Release 实跑验收。发布流程以该验收、签名/公证准备和完整安装包体验验收为主；当前公开分发仍受 [TECH_DEBT.md](TECH_DEBT.md) TD-023 的许可证与素材授权证据阻断。

## 版本策略

- 进入公开发布前使用 `0.x.y`。
- `x` 表示阶段能力推进，例如桌面壳、PathGrant、PSD 工作台。
- `y` 表示修复、文档、验收或小功能。
- 破坏性契约变化必须在 PR 和变更记录中明确说明。

## 发布前检查

1. 确认 [CONTEXT.md](../CONTEXT.md) 的阶段、当前决策、三项优先级和最后验证真实。
2. 确认 [ROADMAP.md](ROADMAP.md) 与当前状态一致。
3. 运行 `npm run verify`。
4. 运行 `npm run assets:web-composer:verify`，确认固定版本的默认视频完整且 SHA-256 匹配。
5. 运行 `npm run release:preflight`，确认 Electron runtime bundle、renderer 资源、Web Composer 视频、图标来源和发布签名/公证环境提示；公开发布还必须运行 `npm run release:preflight:public`，确认根 `LICENSE` 和逐项素材来源/再分发授权证据完整。
6. 已生成本机目录包时，运行 `npm run release:smoke:packaged`；tag Release 会在三个 runner 上自动执行等价烟测，三平台全部通过后才由单一发布 job 汇总并发布产物。
7. 对涉及桌面壳、浏览器 session、PathGrant、下载、转码或 Photoshop 的改动执行对应真实路径验收。
8. 检查仓库不包含 `.env`、凭据、客户素材、缓存、日志或构建产物。
9. 如涉及安全边界变化，更新 [SECURITY.md](../SECURITY.md) 或新增 [ADR](ADR/README.md)。

## Web Composer 素材包

- 当前拆分范围是 8 个默认 MP4：源码仓库保留字体、CSS、必要图片、`assets/web-composer/manifest.json`、操作说明和安装工具，但不跟踪这 8 个视频。
- 素材 Release 使用独立 tag，不标记为产品最新版本；归档名称、下载地址和 SHA-256 固定在清单中。
- `npm run dev` 与 `npm run build` 会先执行素材 `ensure`；已有文件逐项校验通过时不访问网络。
- 更新素材时必须提升素材包版本和 tag，不能覆盖已发布归档后继续复用旧 SHA-256。
- 发布 Electron 候选包前，必须确认 `apps/web/dist/static/web-composer/videos/` 已进入 renderer 资源。
- 素材清单变更必须在同一改动中记录兼容的预设/产品范围、来源与再分发授权，并完成本地归档安装、远端全新安装和逐文件校验。
- 已被任一源码版本引用的素材 Release Asset 必须长期保留；若需要迁移，先发布新版本并验证，再更新源码清单。禁止删除仍被已发布源码或产品引用的旧归档。
- 回滚优先恢复到上一个仍可下载且哈希匹配的清单版本；不得通过跳过哈希、改用浮动 URL 或覆盖旧 tag 回滚。
- 当前仓库和默认视频尚无完整的公开分发许可证/来源清单，因此只允许开发和内部候选构建；公开产品发布必须先补齐根 `LICENSE` 与 `assets/web-composer/PROVENANCE.json` 逐项素材授权记录，`npm run release:preflight:public` 会阻止证据缺失的 tag Release。
- 完整操作与本地覆盖参数见 [素材包说明](../assets/web-composer/README.md)。

## 候选构建

当前候选构建阶段：

- 不把开发模式启动等同于发布构建。
- 不把 `apps/web` 构建通过等同于桌面端可发布。
- 不把 electron-builder 目录包通过等同于完整安装包可分发。
- 候选构建必须启动真实桌面窗口验证根路由、API 请求和代表性静态资源；不可把结构入包或单独 `/api/health` 通过等同于 renderer 可用。
- 桌面端候选构建必须记录操作系统、Node.js 版本、Electron 版本、本地 API 启动方式和已验收路径。

当前 Electron 发布预检覆盖：

- `apps/web/dist` 是否打入 `renderer` 资源目录。
- 固定版本的 Web Composer 素材清单和默认视频是否进入 renderer 构建目录。
- `apps/api/dist/server.cjs` 是否打入 `api` 资源目录。
- 桌面主进程构建、preload 文件和共享 app 图标来源是否存在。
- macOS / Windows / Linux 目标和 artifact 命名是否已配置。
- `CSC_LINK` / `CSC_NAME`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 等签名与公证环境变量是否已准备；缺失时为警告，设置 `MEDIATOOLBOX_RELEASE_STRICT=1` 或传入 `--strict` 可将警告视为失败。

常规 preflight 覆盖配置与文件存在性；公开发布 preflight 额外核验项目许可证和素材清单逐项授权证据。tag Release workflow 会先在 Windows、macOS、Linux 分别生成目录包，启动其中的 Electron 窗口并验证根 renderer、同源 `/api/health`、图标和代表性 Web Composer 视频；Linux runner 使用 `xvfb`。matrix job 只上传 workflow artifact，不直接写 GitHub Release；三平台全部通过后，单一 `publish` job 创建草稿、汇总上传并转为正式 Release，已发布 tag 不允许覆盖。该流程首次成功前，候选构建仍不视为已运行验收。

GitHub CI 的真实转码回归依赖系统 `ffmpeg`。CI workflow 必须在三个 runner 上显式安装并运行 `ffmpeg -version`，不能依赖 hosted image 的隐式预装状态。

## 变更记录

发布说明至少包含：

- 新增能力。
- 修复问题。
- 安全或权限边界变化。
- 已知黄灯和未完成验收。
- 回滚方式或禁用方式。

## 回滚原则

- API 契约、数据库 schema、PathGrant、文件写入和任务状态机相关变更必须提供回滚判断。
- 不能安全回滚时，发布说明中必须标记为单向迁移。
- 出现任意文件读写、命令注入、session 泄露或数据损坏风险时，优先撤回发布并修复。
