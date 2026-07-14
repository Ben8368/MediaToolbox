# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4.5/5 已接入；Phase 5.5 Web Composer beta 已接入；Phase 6A/B/C PathGrant 工作区外路径授权管道已落地
> **最近更新：** 2026-07-14
> - Web Composer 字体/图片已随源码本地化，8 个默认 MP4 已迁移到固定 SHA-256 的 `web-composer-assets-v1` Release Asset；根开发入口、Web 开发和构建均接入素材 `ensure`。
> - 源码/视频资源包边界已补充 ADR、维护责任、安全、发布、PR 与回滚治理；公开分发仍需补齐项目许可证和逐项素材授权记录。
> - GitHub CI 已显式准备 `ffmpeg` 并升级官方 checkout/setup-node action，避免 hosted runner 工具缺失和 Node 20 action 警告。
> - PathGrant 生命周期、统一 Job 取消与 PSD scan/apply 可取消异步执行已收口。
> - Web Composer Slot v2、统一可调侧栏、Browser Network 多标签事件隔离和 Electron 生产打包基础链路均已接入，剩余事项进入下方验收清单。
> - 后续 Phase 11 已规划独立的「社交场景生成工作台」：先以微信对话的项目编辑、长图 PNG 与自动播放 MP4 验证闭环，不改变现有网页合成工作台边界。

## 项目定位

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。目标是用 TypeScript 统一前后端主要开发体验，提供文件管理、下载、转码、网页合成、PSD 模板处理、浏览器辅助和批量自动化能力。

## 当前快照

- **仓库形态：** npm workspaces monorepo。
- **前端：** `apps/web`，React 18 + TypeScript + Vite + Zustand；保留 NAS 风格 UI、窗口系统、下载器、文件管理器、转码工作台、PSD 工作台、Web Composer 工作台、设置、日志和浏览器入口。
- **桌面壳：** `apps/desktop`，具备 Electron BrowserWindow、托盘、基础 IPC、可选本地 API 子进程启动能力；浏览器 app 通过 `WebContentsView` 由主进程承载真实网页，并已接入 Browser Network session、权限审计和下载事件。
- **API：** `apps/api`，Fastify 本地服务已对齐下载、浏览器网络、文件浏览、网页合成、系统指标、日志、通知和 jobs 的最小契约。
- **共享包：** `packages/contracts`、`job-core`、`process-manager`、`downloader`、`ffmpeg`、`psd-core`、`media-core`、`db`、`ui` 已建立第一版边界。
- **Workers：** `download-worker`、`transcode-worker`、`web-render-worker`、`psd-worker` 已有真实工具入口或可注入执行边界。
- **验证：** 2026-07-14 本轮 `npm run verify` 已通过；API 60、Web 66、DB 21、Desktop 9 项测试及其余 workspace 测试、类型检查、生产构建全部成功，GitHub CI 失败对应的真实 ffmpeg 转码/VMAF 回归均在本地通过。Web Composer 素材包校验与根 `predev` ensure 通过，workflow YAML 和本地 Markdown 链接已解析检查；预览区直接点选的最终主观手感仍待验收。

## 当前阻断项

- 无。

## 剩余黄灯

> **技术债追踪：** 系统性优化项已迁移至 `docs/TECH_DEBT.md`，本节仅保留阶段相关的待验收项。

- Browser Network 待桌面端体验验收：真实文件下载、进度回写、取消、失败提示、权限日志、错误页重试和多标签页 view 生命周期。
- PSD 工作台待真实 Photoshop 本机联调，并补齐 image / smart-object slot 渲染与复杂 batchPlay。
- Electron 发布 polish 待补齐：签名、公证与完整安装包发布验收；图标资源入口与 release preflight 已接入。
- 文件管理器上传速率（文件管理器 multipart 上传字节统计）仍待真实大文件上传体验验收。
- Web Composer 默认视频的 Release Asset 分发与远端下载验收已通过；4K/15 秒长时视频压力验收仍待补齐。
- Web Composer Slot v2 的预览区直接点选、隐藏恢复和编辑/交互预览切换仍待用户完成主观手感确认。
- 公开分发前需补齐项目 `LICENSE` 与 8 个默认 MP4 的逐项来源/再分发授权记录；内部开发和候选构建不受影响。

**已迁移至技术债追踪：**
- TD-021: Web Composer 默认素材离线资源包与 4K/15 秒压力验收
- TD-023: Web Composer 默认视频来源与再分发授权
- TD-012: 浏览器 app 纯 Web 模式降级体验
- TD-013: 浏览器多标签页桌面端真机验收（标签切换 view 生命周期、网络事件按标签隔离）
- TD-019: Electron 发布 polish（应用图标、签名、公证与完整安装包验收）
- TD-015: PSD 真实 Photoshop 联调（本机命令路径、复杂 batchPlay、image/smart-object slot）
- TD-016: macOS GPU 指标采集（Apple Silicon 已验收归档）

## 下一步

1. 用户主观确认 Web Composer 三套预设的预览区直接点选、隐藏恢复和编辑/交互预览切换；继续验收图片/视频替换与 4K/15 秒压力路径。
2. 验收 Phase 4.5：桌面浏览器下载真实文件、进度回写、取消、失败提示、权限日志和新增错误页重试路径。
3. PSD 工作台端到端联调：配置真实 Photoshop 命令，验证 `POST /api/psd/scan` → 工单编辑 → `POST /api/psd/workorders/{id}/apply` 的异步执行、取消和外部路径授权闭环。
4. 进入 Phase 5 深水区：image/smart-object slot 渲染实现、复杂 batchPlay 联调。
5. 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），并继续完善 Electron 发布 polish（应用图标、签名、公证与完整安装包验收）。
6. 继续验收真实大文件上传流量采集（非浏览器请求体场景已接入文件管理器上传）。
7. Phase 6A/B/C PathGrant 管道已落地，后续继续验收外部导入/导出和目录级授权浏览的桌面端体验；详见 `docs/ROADMAP.md` Phase 6、`docs/ARCHITECTURE.md` 与 `docs/FRONTEND_API_CONTRACT.md`。
8. 公开候选版本前确认 8 个默认 MP4 的来源与再分发授权，并补充项目许可证；无法确认授权的素材必须替换。
9. 内部候选版本稳定后，按 `docs/ROADMAP.md` Phase 11 启动社交场景生成工作台 MVP；首期仅覆盖微信单聊，后续再评估朋友圈与其他平台场景。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 通过 supervisor 统一启动前端开发服务器和本地 API |
| `npm run dev:web` | 单独启动前端开发服务器 |
| `npm run dev:api` | 单独启动本地 API 服务 |
| `npm run dev:desktop` | 启动桌面壳开发入口 |
| `npm run assets:web-composer:verify` | 校验 Web Composer 默认视频素材包 |
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
