# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4.5/5 已接入；Phase 5.5 Web Composer beta 已接入；Phase 6A/B/C PathGrant 工作区外路径授权管道已落地
> **最近更新：** 2026-07-13
> - Web Composer 三套默认预设的字体、视频和 Lumora 火车窗前景图已本地化到 `apps/web/public/static/web-composer/`，预览页与默认 manifest 不再依赖远程素材加载。
> - Web Composer 排版控件改为下拉选择字体、设计字号与可读字重，编辑对象大纲和属性区收进同一连续面板；顶部参数与操作控件统一为 30px 高，预设选择器进一步收至 96px。
> - Web Composer 侧栏已将“画布主题”并入“编辑对象”大纲，与元素共用搜索和选择入口；窗口标题栏预设选择器进一步收窄，视频导出默认值调整为 30 fps / 10 秒。
> - Web Composer 已升级为 Slot v2 的“预览区点选、左侧上下文编辑”工作流：三套预设提供显式文案/Logo/Icon/背景 Slot，支持字体、设计字号、字重、颜色、内容类型替换、X/Y 偏移和显隐；元素大纲支持搜索、分组与隐藏恢复，编辑/交互预览模式分离。
> - Web Composer Inspector 已按画布点选工作流收紧：元素大纲获得独立且更高的滚动空间，未选中时直接显示画布主题控件；冗余说明与导出尺寸文案已移除，顶部参数改为紧凑字段内单位提示，预览画布补充极浅边界以适配深色预设。
> - 各工作台左侧栏已统一为 `200px` 默认宽度，并接入共享拖拽调整、键盘调整、双击复位与按 App 记忆宽度能力。
> - Web Composer 的预设入口位于窗口右上角的紧凑可滚动选择菜单；当前 Slot 的编辑能力收纳到左侧上下文 Inspector，导出参数与操作位于预览区顶部。
> - Web Composer 已按桌面 App 模式接入统一应用注册，继承 `960×640` 默认窗口和 `760×520` 最小窗口；三套版本化预设、Slot 编辑、精确尺寸画布、PNG/MP4 Job/Asset 导出闭环已完成本地烟测。
> - Electron 生产打包基础链路已打通：renderer/API runtime 入包、`userData` 工作区与 SQLite 默认路径、macOS arm64 `electron-builder --dir` 和包内 `/api/health` 烟测已通过；发布侧仍待签名、公证与完整安装包验收。
> - Phase 6A-C PathGrant 管道已落地：读/写/目录读授权、`inputGrantId` / `outputGrantId` 任务扩展、转码/PSD 外部导入导出和纯 Web 降级已接入；下一步继续做桌面端体验与边界验收。
> - Browser Network 多标签能力继续收口：下载、权限和上传侧栏事件已按活动 `viewId` 隔离，下载取消校验标签归属；下一步验收桌面端 view 生命周期和真实下载/权限路径。
> - 文件管理器上传/下载真实 API 与 multipart 上传字节统计已接入；下一步验收真实大文件上传体验。
> - PSD 渲染 API、manifest 持久化和工作台闭环已接入；下一步做真实 Photoshop 联调与 image / smart-object slot 渲染。

## 项目定位

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、网页合成、PSD 模板处理、浏览器辅助和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留 NAS 风格 UI、窗口系统、下载器、文件管理器、转码工作台、PSD 工作台、Web Composer 工作台、设置、日志和浏览器入口。
- **桌面壳：** `apps/desktop`，具备 Electron BrowserWindow、托盘、基础 IPC、可选本地 API 子进程启动能力；浏览器 app 通过 `WebContentsView` 由主进程承载真实网页，并已接入 Browser Network session、权限审计和下载事件。
- **API：** `apps/api`，Fastify 本地服务已对齐下载、浏览器网络、文件浏览、网页合成、系统指标、日志、通知和 jobs 的最小契约。
- **共享包：** `packages/contracts`、`job-core`、`process-manager`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker`、`transcode-worker`、`web-render-worker`、`psd-worker` 已有真实工具入口或可注入执行边界。
- **验证：** 2026-07-13 `npm run verify` 已通过；Web Composer v2 manifest/default/DOM Slot 契约、消息校验、状态更新与 API 版本拒绝路径已纳入测试，浏览器自动化已确认大纲选择、上下文编辑器刷新、选择框与设计坐标回传；预览区直接点选的最终主观手感仍待用户确认。既有 PNG 和 H.264 MP4 本地烟测保持有效；浏览器 app 拖拽、缩放已完成用户主观验收；右侧状态面板 CPU / 内存 / GPU 仪表已验收为真实系统采样（开发模式 Web + 本地 API）。

## 当前阻断项

- 无。

## 剩余黄灯

> **技术债追踪：** 系统性优化项已迁移至 `docs/TECH_DEBT.md`，本节仅保留阶段相关的待验收项。

- Browser Network 待桌面端体验验收：真实文件下载、进度回写、取消、失败提示、权限日志、错误页重试和多标签页 view 生命周期。
- PSD 工作台待真实 Photoshop 本机联调，并补齐 image / smart-object slot 渲染与复杂 batchPlay。
- Electron 发布 polish 待补齐：签名、公证与完整安装包发布验收；图标资源入口与 release preflight 已接入。
- 文件管理器上传速率（文件管理器 multipart 上传字节统计）仍待真实大文件上传体验验收。
- Web Composer 默认预设素材已本地化；4K/15 秒长时视频压力验收待补齐。
- Web Composer Slot v2 的预览区直接点选、隐藏恢复和编辑/交互预览切换仍待用户完成主观手感确认。

**已迁移至技术债追踪：**
- TD-021: Web Composer 默认素材离线资源包与 4K/15 秒压力验收
- TD-012: 浏览器 app 纯 Web 模式降级体验
- TD-013: 浏览器多标签页桌面端真机验收（标签切换 view 生命周期、网络事件按标签隔离）
- TD-019: Electron 发布 polish（应用图标、签名、公证与完整安装包验收）
- TD-015: PSD 真实 Photoshop 联调（本机命令路径、复杂 batchPlay、image/smart-object slot）
- TD-016: macOS GPU 指标采集（Apple Silicon 已验收归档）

## 下一步

1. 用户主观确认 Web Composer 三套预设的预览区直接点选、隐藏恢复和编辑/交互预览切换；继续验收图片/视频替换与 4K/15 秒压力路径。
2. 验收 Phase 4.5：桌面浏览器下载真实文件、进度回写、取消、失败提示、权限日志和新增错误页重试路径。
3. PSD 工作台端到端联调：配置真实 Photoshop 命令，验证 `POST /api/psd/render` 输出正确 PNG，验证 manifest 保存/加载往返。
4. 进入 Phase 5 深水区：image/smart-object slot 渲染实现、复杂 batchPlay 联调。
5. 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），并继续完善 Electron 发布 polish（应用图标、签名、公证与完整安装包验收）。
6. 继续验收真实大文件上传流量采集（非浏览器请求体场景已接入文件管理器上传）。
7. Phase 6A/B/C PathGrant 管道已落地，后续继续验收外部导入/导出和目录级授权浏览的桌面端体验；详见 `docs/ROADMAP.md` Phase 6、`docs/ARCHITECTURE.md` 与 `docs/FRONTEND_API_CONTRACT.md`。

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
| `. .\scripts\dev\init-utf8-console.ps1` | 初始化当前 PowerShell 会话的 UTF-8 输入输出 |

## 常用文档

- 治理规则：[AGENTS.md](AGENTS.md)
- 架构说明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 错题索引：[LESSONS.md](LESSONS.md)
- 审查规格：[docs/AI_RULES.md](docs/AI_RULES.md)
- 技术债追踪：[docs/TECH_DEBT.md](docs/TECH_DEBT.md)
- API 契约：[docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)
- API 联调：[docs/API_VALIDATION.md](docs/API_VALIDATION.md)
- UI 兼容：[docs/UI_COMPAT.md](docs/UI_COMPAT.md)
- 路线图：[docs/ROADMAP.md](docs/ROADMAP.md)（含 Phase 6 工作区外路径授权状态）
- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全政策：[SECURITY.md](SECURITY.md)
- 发布流程：[docs/RELEASE.md](docs/RELEASE.md)
- 维护职责：[docs/MAINTAINERS.md](docs/MAINTAINERS.md)
- 架构决策：[docs/ADR/](docs/ADR/README.md)
