# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4.5/5 已接入；Phase 6A/B/C PathGrant 工作区外路径授权管道已落地
> **最近更新：** 2026-07-08
> - Electron 生产打包基础链路已打通：`apps/api` 新增 esbuild 生产 runtime bundle；`apps/desktop` 打包资源包含 Web renderer 与 API runtime；packaged 主进程通过 Electron `ELECTRON_RUN_AS_NODE` 启动本地 API，并将工作区和 SQLite DB 默认收敛到 `userData`；macOS arm64 `electron-builder --dir` 已通过，包内 `/api/health` 烟测已通过。
> - Phase 6A-C PathGrant 已接入：`packages/contracts` 新增 PathGrant 类型族；`packages/db` schema V3 新增 `path_grants` 表及 `pathGrants` DB 命名空间；`POST/GET/DELETE /api/path-grants` 三条路由已注册（仅桌面端可签发，TTL file.read=1h / file.write=30min / dir.read=2h）；`workspace-path.ts` 新增 `resolveGrantPath()`；Electron 新增三个 IPC handler（`mediatoolbox:path-grant:request-read/write/dir-read`）及对应 dialog 流程；前端 `apps/web/src/api/real/pathGrants.ts` 适配层已实现（含纯 Web 模式降级）。
> - 文件管理器上传与下载能力落地：`POST /api/filebrowser/upload`（multipart，500 MB 上限，文件名净化，工作区边界）和 `GET /api/filebrowser/file`（流式下载，Content-Disposition attachment）已接入真实 API；前端工具栏上传按钮和下载按钮均已接通。
> - 已接入：右侧状态面板 CPU / 内存 / GPU、浏览器错误页、生产资源相对路径、浏览器多标签页前端 UI、PSD 渲染 API 与 manifest 持久化。
> - PathGrant 已全面集成：transcode/PSD 路由支持 inputGrantId（外部输入）；前端转码工作台新增「从外部导入」按钮，调用 requestReadGrant() 获取授权并自动填充输入。
> - Phase 6B outputGrantId 已落地：transcode/PSD render 支持 outputGrantId 工作区外写授权；PSD 工作台加「导出到外部」按钮（requestWriteGrant）；全部已推送至远端。
> - 浏览器多标签网络事件继续推进：下载、权限和上传侧栏事件已按活动 `viewId` 展示，下载取消校验发起标签归属，避免后台标签事件干扰当前标签。
> - Electron 发布 polish 继续推进：桌面窗口/托盘统一使用 renderer app 图标资源；新增 `npm run release:preflight` 检查 runtime bundle、renderer/API 打包资源、artifact 命名和签名/公证环境提示，并接入 release workflow。
> - 系统指标继续补齐：macOS GPU 利用率新增 `ioreg IOAccelerator` 采样路径；项目上传速率新增文件管理器 multipart 上传字节统计，不再只依赖浏览器网络请求体。
> - 待后续：真实 Photoshop 联调、多标签页桌面端真机验收、完整安装包签名/图标与跨平台 release 验收。

## 项目定位

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、PSD 模板处理、浏览器辅助和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留 NAS 风格 UI、窗口系统、下载器、文件管理器、转码工作台、PSD 工作台、设置、日志和浏览器入口。
- **桌面壳：** `apps/desktop`，具备 Electron BrowserWindow、托盘、基础 IPC、可选本地 API 子进程启动能力；浏览器 app 通过 `WebContentsView` 由主进程承载真实网页，并已接入 Browser Network session、权限审计和下载事件。
- **API：** `apps/api`，Fastify 本地服务已对齐下载、浏览器网络、文件浏览、系统指标、日志、通知和 jobs 的最小契约。
- **共享包：** `packages/contracts`、`job-core`、`process-manager`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker`、`transcode-worker`、`psd-worker` 已有真实工具入口或可注入执行边界。
- **验证：** `npm run verify` 已通过；浏览器 app 拖拽、缩放已完成用户主观验收；右侧状态面板 CPU / 内存 / GPU 仪表已验收为真实系统采样（开发模式 Web + 本地 API）。

## 当前阻断项

- 无。

## 剩余黄灯

> **技术债追踪：** 系统性优化项已迁移至 `docs/TECH_DEBT.md`，本节仅保留阶段相关的待验收项。

- Browser Network 待桌面端体验验收：真实文件下载、进度回写、取消、失败提示、权限日志、错误页重试和多标签页 view 生命周期。
- PSD 工作台待真实 Photoshop 本机联调，并补齐 image / smart-object slot 渲染与复杂 batchPlay。
- Electron 发布 polish 待补齐：签名、公证与完整安装包发布验收；图标资源入口与 release preflight 已接入。
- macOS GPU 指标与文件管理器上传速率已接入基础采样，仍待跨机型与真实大文件上传体验验收。

**已迁移至技术债追踪：**
- TD-012: 浏览器 app 纯 Web 模式降级体验
- TD-013: 浏览器多标签页桌面端真机验收（标签切换 view 生命周期、网络事件按标签隔离）
- TD-019: Electron 发布 polish（应用图标、签名、公证与完整安装包验收）
- TD-015: PSD 真实 Photoshop 联调（本机命令路径、复杂 batchPlay、image/smart-object slot）
- TD-016: macOS GPU 指标采集

## 下一步

1. 验收 Phase 4.5：桌面浏览器下载真实文件、进度回写、取消、失败提示、权限日志和新增错误页重试路径。
2. PSD 工作台端到端联调：配置真实 Photoshop 命令，验证 `POST /api/psd/render` 输出正确 PNG，验证 manifest 保存/加载往返。
3. 进入 Phase 5 深水区：image/smart-object slot 渲染实现、复杂 batchPlay 联调。
4. 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），并继续完善 Electron 发布 polish（应用图标、签名、公证与完整安装包验收）。
5. 继续验收 macOS GPU 指标跨机型兼容性与真实大文件上传流量采集（非浏览器请求体场景已接入文件管理器上传）。
6. Phase 6A/B/C PathGrant 管道已落地，后续继续验收外部导入/导出和目录级授权浏览的桌面端体验；详见 `docs/ROADMAP.md` Phase 6、`docs/ARCHITECTURE.md` 与 `docs/FRONTEND_API_CONTRACT.md`。

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

- 治理规则：`AGENTS.md`
- 架构说明：`docs/ARCHITECTURE.md`
- 错题索引：`LESSONS.md`
- 审查规格：`docs/AI_RULES.md`
- 技术债追踪：`docs/TECH_DEBT.md`
- API 契约：`docs/FRONTEND_API_CONTRACT.md`
- API 联调：`docs/API_VALIDATION.md`
- UI 兼容：`docs/UI_COMPAT.md`
- 路线图：`docs/ROADMAP.md`（含 Phase 6 工作区外路径授权状态）
- 贡献流程：`CONTRIBUTING.md`
- 安全政策：`SECURITY.md`
- 发布流程：`docs/RELEASE.md`
- 维护职责：`docs/MAINTAINERS.md`
- 架构决策：`docs/ADR/`
