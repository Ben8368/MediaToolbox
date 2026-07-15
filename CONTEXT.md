# 当前状态

> **初始基线：** 2026-07-02
> **当前分支：** `main`
> **当前阶段：** Phase 4.5/5 已接入；Phase 5.5 Web Composer beta 已接入；Phase 6A/B/C PathGrant 工作区外路径授权管道已落地
> **最近更新：** 2026-07-15
> - API Job、PSD workorder 与 Electron Browser Network 上报 ID 已统一为带业务前缀的 UUID；冻结时钟并发回归覆盖 100 个任务。
> - API 启动会原子恢复 SQLite 遗留的 `queued` / `running` / `paused` 孤儿任务：标记为 `failed`、记录重启原因并吊销绑定 PathGrant；自动重试、断点续跑和 executor 安全关闭屏障仍列入 TD-028。
> - Release workflow 已改为三平台只构建、目录包烟测和上传 workflow artifact，单一 `publish` job 在授权门禁与三平台构建全部通过后发布；已发布 tag 禁止覆盖。
> - 公开发布新增 `npm run release:preflight:public`，自动核验根 `LICENSE` 与默认视频逐项来源/再分发授权记录；当前证据尚缺，因此公开 tag Release 会被有意阻止。
> - API 回归测试已按下载、转码、PSD 与重启恢复拆分，原 `app.test.ts` 从 1049 行降至 315 行。
> - PSD scan 成功生成持久工单时会保留同 ID 输入 PathGrant 供后续 apply 使用；scan 失败/取消、API 重启恢复或 apply 终结时仍会吊销授权。
> - Electron 生产 renderer 改由包内本地 API 同源托管，修复 `file://` 下路由、`/api` 与绝对静态资源无法协作的问题；已补同源 renderer、静态资源与 SPA 路由自动化覆盖。真实 Windows/macOS/Linux 目录包启动验收仍待执行。
> - 下载请求已收敛为共享契约，输出目录、字幕、H.264/转码、浏览器 Cookie 与有界批次并发均进入 yt-dlp worker / 调度器；未知字段明确返回 4xx。
> - Job 运行中进度改为独立 patch，状态终态写入改为数据库 compare-and-set；取消后到达的成功事件不会创建 Asset 或改写成功状态。
> - 已移除未被调度器使用的 `retrying` Job 伪状态；纯 Web 打开浏览器 app 时会解释 Electron 会话边界，并提供下载器替代路径。
> - Release workflow 已加入真实目录包 renderer 烟测：三平台 Electron 启动后检查根 renderer、同源 API、图标与 Web Composer 视频；首个 tag Release 跑通前仍保留 TD-019 发布验收。
> - 全仓工程审查曾识别 Electron 打包态 renderer / API / 静态资源链路、下载契约、Job 运行进度和取消终态竞态；其中 TD-024、TD-025、TD-026 已于本轮偿还，TD-019 转为三平台目录包验收项。
> - Web Composer 字体/图片已随源码本地化，8 个默认 MP4 已迁移到固定 SHA-256 的 `web-composer-assets-v1` Release Asset；根开发入口、Web 开发和构建均接入素材 `ensure`。
> - 源码/视频资源包边界已补充 ADR、维护责任、安全、发布、PR 与回滚治理；公开分发仍需补齐项目许可证和逐项素材授权记录。
> - GitHub CI 已显式准备 `ffmpeg` 并升级官方 checkout/setup-node action，避免 hosted runner 工具缺失和 Node 20 action 警告。
> - PathGrant 生命周期、统一 Job 取消与 PSD scan/apply 可取消异步执行已收口。
> - Web Composer Slot v2、统一可调侧栏、Browser Network 多标签事件隔离和 Electron 生产打包基础链路均已接入，剩余事项进入下方验收清单。
> - Web Composer 预设页 logo/icon slot 指定 PNG 替换已修复：上传图片会同步切换到 image 分支，Lumora 文案型 Logo 与 VaultShield 图标型 Logo 场景已补回归覆盖；TD-029 已归档。
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
- **验证：** 2026-07-15 `npm run verify` 已通过：35 个测试文件、209 项测试全部通过，workspace TypeScript 类型检查与构建全部通过；`npm run release:preflight:public` 按设计拒绝缺少根 `LICENSE` 与 `assets/web-composer/PROVENANCE.json` 的公开发布，但不影响内部候选构建。

## 当前阻断项

- 无内部开发代码级阻断。公开 tag Release 当前会被授权门禁阻止：仓库缺少根 `LICENSE` 和 8 个默认 MP4 的逐项 `PROVENANCE.json`；证据补齐后才能执行 TD-019 的三平台 tag workflow 实跑验收。

## 剩余黄灯

> **技术债追踪：** 系统性优化项已迁移至 `docs/TECH_DEBT.md`，本节仅保留阶段相关的待验收项。

- Browser Network 待桌面端体验验收：真实文件下载、进度回写、取消、失败提示、权限日志、错误页重试和多标签页 view 生命周期。
- PSD 工作台待真实 Photoshop 本机联调，并补齐 image / smart-object slot 渲染与复杂 batchPlay。
- Electron 签名、公证与完整安装包发布验收须在 TD-019 的三平台目录包功能烟测后继续。
- 文件管理器上传速率（文件管理器 multipart 上传字节统计）仍待真实大文件上传体验验收。
- Web Composer 默认视频的 Release Asset 分发与远端下载验收已通过；4K/15 秒长时视频压力验收仍待补齐。
- Web Composer Slot v2 的预览区直接点选、隐藏恢复和编辑/交互预览切换仍待用户完成主观手感确认。
- 公开分发前需补齐项目 `LICENSE` 与 8 个默认 MP4 的逐项来源/再分发授权记录；内部开发和候选构建不受影响。

**已迁移至技术债追踪：**
- TD-021: Web Composer 默认素材离线资源包与 4K/15 秒压力验收
- TD-023: Web Composer 默认视频来源与再分发授权
- TD-013: 浏览器多标签页桌面端真机验收（标签切换 view 生命周期、网络事件按标签隔离）
- TD-019: Electron 打包态 renderer / API / 静态资源链路不可用
- TD-015: PSD 真实 Photoshop 联调（本机命令路径、复杂 batchPlay、image/smart-object slot）
- TD-016: macOS GPU 指标采集（Apple Silicon 已验收归档）

## 下一步

1. 先选择项目公开许可证并补齐 8 个默认 MP4 的逐项来源、版权方、许可证与再分发证据；无法确认授权的素材必须替换，并通过 `npm run release:preflight:public`。
2. 再验收 TD-019：触发新 tag Release，确认 Windows、macOS、Linux 三个 build job 和单一 publish job 跑通，并保留 renderer、`/api/health`、图标和 Web Composer 视频检查日志；随后继续签名、公证与人工安装体验验收。
3. 用户主观确认 Web Composer 三套预设的预览区直接点选、隐藏恢复和编辑/交互预览切换；继续验收图片/视频替换与 4K/15 秒压力路径。
4. 验收 Phase 4.5：桌面浏览器下载真实文件、进度回写、取消、失败提示、权限日志和错误页重试路径。
5. PSD 工作台端到端联调：配置真实 Photoshop 命令，验证 `POST /api/psd/scan` → 工单编辑 → `POST /api/psd/workorders/{id}/apply` 的异步执行、取消和外部路径授权闭环。
6. 进入 Phase 5 深水区：image/smart-object slot 渲染实现、复杂 batchPlay 联调。
7. 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view）；TD-019 通过后继续签名、公证与完整安装包验收。
8. 继续验收真实大文件上传流量采集（非浏览器请求体场景已接入文件管理器上传）。
9. Phase 6A/B/C PathGrant 管道已落地，后续继续验收外部导入/导出和目录级授权浏览的桌面端体验；详见 `docs/ROADMAP.md` Phase 6、`docs/ARCHITECTURE.md` 与 `docs/FRONTEND_API_CONTRACT.md`。
10. 公开候选版本前确认 8 个默认 MP4 的来源与再分发授权，并补充项目许可证；无法确认授权的素材必须替换。
11. 内部候选版本稳定后，按 `docs/ROADMAP.md` Phase 11 启动社交场景生成工作台 MVP；首期仅覆盖微信单聊，后续再评估朋友圈与其他平台场景。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 通过 supervisor 统一启动前端开发服务器和本地 API |
| `npm run dev:web` | 单独启动前端开发服务器 |
| `npm run dev:api` | 单独启动本地 API 服务 |
| `npm run dev:desktop` | 启动桌面壳开发入口 |
| `npm run assets:web-composer:verify` | 校验 Web Composer 默认视频素材包 |
| `npm run release:smoke:packaged` | 对已生成的本机 Electron 目录包执行 renderer / API / 静态资源烟测 |
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
