# Roadmap

阶段计划放在这里，避免污染每轮必读的 [CONTEXT.md](../CONTEXT.md)。

## 近期规划评估（2026-07）

总体判断：当前路线可行，但后续应先收口已接入能力的真实体验验收，再开启高权限扩展。近期目标不是继续扩大功能面，而是形成一个可交付的内部候选版本：浏览器网络稳定、PathGrant 安全可审计、PSD 基础路径可信、Electron 候选包可运行。

优先级：

1. **先收口 Phase 4.5 / 5 / 6：** 浏览器下载、多标签 `WebContentsView` 生命周期、PathGrant 外部导入/导出、目录级授权浏览、真实大文件上传和 PSD Photoshop 真机联调。
2. **再进入 Phase 7：** Cookie/session profile 和捕获规则配置化可先做；CDP 网络体捕获需等统一 CDP 基座设计完成。
3. **谨慎推进 Phase 8 / 9 / 10：** LLM 只做辅助入口，不进入危险操作闭环；preload/CDP/插件平台必须复用同一套权限、审计和 Job 入库模型。
4. **候选版本稳定后再进入 Phase 11：** 社交场景生成与网页合成保持两条产品线，先以微信对话生成器验证编辑器、离屏渲染与导出闭环。

排期评估（按 1 名主力开发 + 用户关键体验验收估算）：

| 时间窗口 | 阶段 | 目标 | 交付判断 |
| --- | --- | --- | --- |
| 2026-07-10 ~ 2026-07-17 | 收口验收 | Phase 4.5 + Phase 6 桌面端真机验收 | 浏览器下载、多标签、PathGrant、大文件上传形成通过/黄灯清单 |
| 2026-07-20 ~ 2026-07-31 | PSD 真机联调 | Photoshop 命令、roundtrip 基线、text slot 稳定 | PSD 工作台形成可信 MVP；再决定 image / smart-object 细节 |
| 2026-08-03 ~ 2026-08-14 | PSD 深水区 + 候选包 | image / smart-object MVP、unsigned Electron candidate | 内部候选包可运行，不把签名分发作为同一阻断项 |
| 2026-08-17 ~ 2026-08-28 | Release polish | 跨平台安装包、release preflight、签名/公证准备 | 证书齐备则冲公开候选；否则交付 unsigned RC |
| 2026-08-31 ~ 2026-09-11 | Phase 7A/B | Cookie 持久化、session profile、多账号隔离 | 登录态下载能力成型，原始 cookie 不暴露给 Web UI |
| 2026-09-14 ~ 2026-09-25 | Phase 7C + CDP 设计 | 捕获规则配置化、统一 CDP 能力边界 | 形成 ADR 或等价设计文档，作为 Phase 7D / 9 的门禁 |
| 2026-09-28 以后 | Phase 8 / 9 / 10 | LLM 辅助、CDP 捕获、插件平台 | 作为增强能力逐步进入，不阻塞核心产品 |
| 内部候选版本稳定后 | Phase 11 | 社交场景生成工作台 MVP | 微信对话的项目编辑、长图 PNG 与自动播放 MP4 闭环通过，再评估朋友圈和其他平台场景 |

门禁原则：

- Phase 7D 和 Phase 9 共用 Electron `debugger`、Tab 隔离、权限审计和捕获产物入库模型；实现前需先完成统一 CDP 设计，避免重复挂载和审计分叉。
- Phase 9 的 preload 注入只面向用户显式授权的页面辅助脚本、自有内容捕获或可访问性增强；不把规避站点限制作为默认产品承诺。
- Phase 10 插件平台依赖 PathGrant、session profile、CDP 审计和权限模型稳定；在这些基础未稳定前只保留规划，不进入实现。
- MITM HTTPS 代理继续作为远期可选，不进入当前排期承诺。

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
- [x] 前端下载工作台接入本地 API 与 yt-dlp / Browser Network 双通道策略。

## Phase 4：文件库与任务中心

状态：**完成**。

- [x] SQLite 持久化资产、任务和日志。
- [x] 文件浏览接入受控本地工作区映射。
- [x] 日志清理、通知已读和统一 jobs cancel 接入真实状态更新。
- [x] 系统指标接入 uptime、CPU 负载近似值和内存占用采样。
- [x] 文件库接入资产索引，统一显示浏览器下载和转码产出。
- [x] 全局任务中心显示下载、浏览器下载、转码/PSD jobs 的状态、进度和失败原因，并统一走 jobs cancel。
- [x] 前端转码工作台接入真实 `/api/transcode/jobs` 和统一 jobs 取消/轮询链路。

## Phase 4.5：浏览器网络能力层

状态：**非验收类能力已接入，待桌面端统一体验验收**。

目标：把现有真浏览器 app 沉淀为可复用的 Browser Network adapter，让下载、文件管理和后续新增 app 可以按浏览器网络行为执行受控上传下载，同时保留 worker adapter 处理媒体解析和后处理。

- [x] 在 `apps/desktop` 建立 browser session 管理边界，区分默认会话和应用隔离会话。
- [x] 接管 Electron 下载事件，支持下载目标目录、文件名冲突、进度、取消、失败原因和完成通知。
- [x] 建立受控文件选择 / 上传桥接，上传来源仅允许工作区内文件，并要求用户确认；网页 File System Access 权限仍默认拒绝并写入权限审计。
- [x] 在 `apps/api` 冻结 Browser Network 任务契约，纳入统一 jobs、日志、权限校验和工作区路径约束。
- [x] 下载 app 增加双通道策略：普通网页资源走浏览器下载；视频、音频、字幕和后处理继续走 `yt-dlp` / worker。
- [x] 定义权限策略：下载、上传、弹窗、剪贴板、通知、跨域读取和 cookie 访问分别授权，默认不向 Web UI 暴露原始 cookie。
- [x] 补齐浏览器 app 的基础弹窗策略：支持的弹窗 URL 收敛到受控当前视图，不支持的弹窗给出可见错误并写入权限审计。
- [x] 补齐浏览器 app 的错误页：overlay 在 `browserState.error` 存在时显示错误文案与重试按钮。
- [x] `apps/web` Vite 构建加入 `base: './'`，修复生产打包 `file://` 协议资源路径。
- [x] 前端多标签页 UI 接入：`useBrowserTabs` 管理多 `viewId`、独立地址/状态、活动标签独占原生 view、切换时隐藏旧 view；下载、权限和上传侧栏事件已按活动 `viewId` 展示，下载取消也校验 `viewId` 归属（待桌面端真机验收 view 生命周期）。
- [x] Electron 生产打包结构与 API 子进程链路：electron-builder 目录包、preload 生产路径、Web renderer 资源、本地 API production runtime 与包内 `/api/health` 烟测已通过（macOS arm64 `--dir`）。
- [x] 修复 TD-019 的打包态 renderer / API / 静态资源链路并接入三平台真实目录包功能烟测；当前只剩首次 tag Release 实跑验收和单一发布 job 产物汇总验证。
- [ ] Electron 发布 polish：图标资源入口和 release preflight 已接入；macOS/Windows 签名、公证与完整安装包发布仍待验收。

## Phase 5：PS / PSD 工作台

状态：**核心工作台闭环已接入（检查/编辑/渲染/持久化），待 Photoshop 本机联调**。

- 定义 PSD template manifest。
- 支持 slot 检查、文案替换、底图替换、尺寸变体和批量导出。
- [x] 建立 Photoshop JSX adapter 与可配置命令 runner。
- [x] 前端 PSD 工作台接入模板检查入口，Photoshop 未配置时返回可读错误。
- [x] 新增渲染 API 路由 `POST /api/psd/render`，接入 `psd-worker` render job。
- [x] 前端新增 manifest 编辑标签页（slot label/kind/required 可编辑）。
- [x] 前端新增批量渲染标签页（文字 slot 表单提交渲染，展示成功/失败与输出路径）。
- [x] manifest 持久化：`POST /api/psd/manifests/save` / `GET /api/psd/manifests/load`，JSON sidecar 存于 PSD 同目录。
- [ ] 复杂 PSD 接 Photoshop 本机联调；优先 DOM，复杂命令再 batchPlay。
- [ ] image / smart-object slot 渲染实现（当前渲染脚本仅处理 text slot）。

## Phase 5.5：Web Composer 工作台

状态：**桌面 App beta 已接入，基础 PNG/MP4 闭环与默认素材离线化已验收；待 4K 长时压力验收**。

- [x] 通过统一 `appRegistry` 接入 `web-composer`，复用全局窗口默认/最小尺寸和任务状态徽章。
- [x] 接入 Lumora、多展示、Trace Grid、VEX Vision、Wandor、Foundation、VaultShield、Viktor 共 8 个版本化 Slot v2 预设；预设 DOM、样式和动画由完整性测试锁定，manifest/default/DOM Slot 绑定由契约测试校验；独立 `/preset/` 预览路由可选择预设与画幅。
- [x] 支持在预览区点击文案、Logo、图标或背景，由左侧上下文 Inspector 按 manifest 动态提供文案、字体、字号、字重、颜色、Icon/图片/媒体替换、X/Y 偏移和显隐编辑；不提供任意 DOM 拖拽或结构改写。
- [x] 元素大纲支持搜索、分组和隐藏 Slot 恢复；编辑/交互预览模式分离，多工作台消息通过 session、source、origin 和预设版本隔离，选择 overlay 不进入导出捕获层。
- [x] 独立 iframe 以目标像素尺寸渲染，工作台只缩放外层预览；支持 `16:9`、`4:3`、`1:1`、`9:16` 和 720p/1080p/1440p/4K。
- [x] PNG 与 MP4 接入统一 Job/Asset；WebM 由 `web-render-worker` 通过 ffmpeg 编码为 H.264 MP4，输出固定进入 `/Workspace/Exports`。
- [x] 所有预设支持去除背景后导出透明 PNG；MP4 导出菜单提供 VP9 Alpha 捕获、ProRes 4444（`yuva444p10le`）透明 MOV。
- [x] 2026-07-13 完成桌面默认/最小窗口、Slot 编辑、4:3 画布、PNG 和 1 秒 MP4 本地烟测。
- [x] 默认字体和必要图片已随源码本地化；8 个基础 MP4 使用固定 SHA-256 的版本化 Release Asset，3 个补充 MP4 固定上游 HTTPS URL、大小和 SHA-256，安装后均由本地静态路径提供。
- [ ] 完成 4K/15 秒、8 个预设和图片/视频替换的桌面端压力与体验验收。

## Phase 6：工作区外路径授权

状态：**Phase 6A/B/C 管道已落地，桌面端体验与边界验收继续跟进**。

目标：在保持默认工作区沙箱的前提下，允许用户通过**单次授权**临时读取工作区外文件；若需写入工作区外路径，则要求**二次授权**。避免直接开放盘符浏览或永久扩大 `normalizeWorkspacePath` 边界。

设计原则：

- 默认路径仍走 `normalizeWorkspacePath()`；越界访问必须携带 API 签发的 `PathGrant`，前端不得提交裸盘符/UNC 路径。
- **读授权**：桌面原生 open dialog / 受控 picker 选文件后，由 `apps/api` 签发短期 read grant；任务/worker 通过 `grantId` 解析物理路径，grant 绑定 job 生命周期。
- **写授权**：单独确认（建议桌面 `showSaveDialog`）；scope 更窄、TTL 更短，默认 one-shot。
- **读入工作区不算越界写**：例如从 `D:` 读取并写入 `/Workspace/Exports` 仅需 read grant。
- 授权事件写入审计日志，模式参考 `browser-network/permission-events`。
- 纯 Web 模式可降级为不可用或只读提示，与 TD-012 衔接。

分期：

| 子阶段 | 范围 | 典型场景 |
| --- | --- | --- |
| 6A | 单文件 read grant | 已接入：转码/PSD 外部输入、文件导入 |
| 6B | 单路径 write grant | 已接入：导出到工作区外 |
| 6C | 目录级 read grant 管道 | 已接入：目录授权浏览基础管道；体验验收继续跟进 |

已接入端点（详见 [FRONTEND_API_CONTRACT.md](FRONTEND_API_CONTRACT.md) 安全边界章节）：

- `POST /api/path-grants` — 桌面端选路后签发 grant
- `GET /api/path-grants/{id}` — 校验与展示
- `DELETE /api/path-grants/{id}` — 主动吊销 grant
- 任务 payload 扩展 `inputGrantId` / `outputGrantId`

与现状关系：文件管理器 `GET /api/filebrowser/disks` 已展示真实磁盘容量；未映射磁盘不直接开放裸路径，目录级授权浏览必须经桌面端 dialog 和 PathGrant。

## Phase 7：会话增强与内容捕获规则

状态：**规划中**。

目标：把现有 Electron session 管理升格为"带登录态的内容捕获层"，覆盖 yt-dlp 单独处理不了的场景（需登录内容、特殊格式、yt-dlp 不支持的平台）。

设计原则：

- Cookie 不向 Web UI 暴露原始值；导出通道仅限 yt-dlp 参数注入，不落盘明文。
- 多账号 session 与 PathGrant 模式一致：前端只传 profileId，物理 session 由桌面端持有。
- 捕获规则配置化，不硬编码双通道策略；规则变更不需要发版。
- CDP 网络体捕获不得先行独立实现；需先完成统一 CDP 基座设计，明确 debugger 挂载、Tab 隔离、权限审计、Job 入库和降级策略。

分期：

| 子阶段 | 范围 | 典型场景 |
| --- | --- | --- |
| 7A | Cookie 持久化与 yt-dlp 打通 | B站大会员、YouTube Premium、需登录的私有内容 |
| 7B | 多账号 session profile 管理 | 不同平台用不同登录态，账号切换不影响其他任务 |
| 7C | 捕获规则配置化 | URL 模式 → 通道路由（浏览器下载 / yt-dlp / 拒绝），JSON 规则热更新 |
| 7D | CDP 网络体捕获 | 在统一 CDP 基座完成后，通过 Electron `debugger` API 抓取 XHR/Fetch 响应体；覆盖 yt-dlp 无法解析的 API 接口型内容（弹幕、字幕 JSON、私有 CDN 清单） |

改动范围：`apps/desktop`（session profile 管理、CDP debugger 基座）、`apps/api`（账号配置与规则接口）、`apps/web`（账号管理 UI）、`packages/downloader`（Cookie 注入逻辑）。不改变现有 worker 边界。

## Phase 8：LLM 辅助工作流

状态：**规划中**。

目标：通过 LLM API 调用让下载和批量任务更智能，不引入完整 Agent Runtime，不改变现有 job 模型。

设计原则：

- LLM 仅做意图解析，不直接操作文件系统或执行任务；解析结果交回现有 job 管线。
- Provider 可配置（OpenAI / Claude / 本地模型），API key 存本地配置，不上传任何文件内容。
- 降级安全：LLM 不可用时退回手动输入，不阻断核心功能。

核心能力：

- **URL 意图识别**：粘贴 URL 自动判断是视频 / 文档 / 图集 / 普通文件，自动路由到对应工作台。
- **批量任务解析**：支持自然语言输入（如"把这个播放列表的 1080p 都下了，文件名带日期"），LLM 解析为结构化 job 参数。
- **格式与质量建议**：根据文件类型和用户历史推荐转码预设或下载格式。

架构参考：参照 C:\Scry 已验证的 Agent 设计——Provider 无关的 `runAgentTurn` async generator、Dry-Run 危险操作守卫、每日 Token/Cost 限额、AbortController 取消。Provider 差异（Anthropic / OpenAI 兼容格式）在 adapter 层消化，上层逻辑不感知。

改动范围：新增 `packages/agent`（TypeScript，薄封装 LLM API）、`apps/api` 新增 `/api/agent/parse-url` 和 `/api/agent/parse-intent` 端点、`apps/web` 下载和批量任务入口增加 LLM 辅助入口。现有 worker 和 job 模型不变。

## Phase 9：浏览器体验深化

状态：**规划中**。

目标：通过用户显式授权的 preload 辅助脚本和 CDP 捕获能力，把浏览器 app 从"网页容器"升格为"可审计的内容捕获浏览器"，对标 C:\Scry 已验证的 Electron 内 CDP 能力边界。

设计原则：

- preload 注入按 Tab 隔离，只面向用户显式授权的页面辅助脚本、自有内容捕获或可访问性增强；默认关闭，按站点或 Tab 授权。
- CDP debugger 挂载限于活动 Tab，挂载/卸载事件写入权限审计日志，与 Phase 4.5 权限模型一致，并复用 Phase 7D 前置的统一 CDP 基座。
- Canvas 捕获产物走现有 Job 模型入库，不绕过工作区路径约束。

分期：

| 子阶段 | 范围 | 典型场景 |
| --- | --- | --- |
| 9A | Tab preload 注入 | 页面辅助脚本、自有内容捕获、可访问性增强（per-tab / per-site 独立开关，用户显式授权） |
| 9B | CDP Canvas 录制与视觉截图 | canvas 渲染型平台（如部分漫画阅读器、文档预览）内容截取；CDP 截图作为视觉兜底 |

改动范围：`apps/desktop`（preload 脚本扩展、CDP debugger 管理）、`apps/api`（捕获任务接口）、`apps/web`（浏览器 app 设置面板扩展）。

## Phase 10：插件平台

状态：**规划中**。

目标：允许用户编写自定义捕获脚本，在 Worker Thread 沙箱中运行，无需修改主程序即可扩展平台支持。对标 C:\Scry Worker Thread 沙箱 + 权能系统的已验证方案，不引入 WASM 运行时。

进入门槛：PathGrant、session profile、统一 CDP 审计和 Job 入库模型稳定后再启动实现；在此之前只保留方案设计和接口草案。

设计原则：

- 插件运行在 Node.js `worker_threads` 沙箱，通过白名单权能 API 与主进程通信，不直接访问文件系统或网络。
- 权能按最小原则授予：读工作区 / 写工作区 / 发起受控网络请求 / 提交 Job；危险操作（写工作区外、访问原始 Cookie）需用户二次确认，与 PathGrant 模式一致。
- 所有插件操作写入审计日志；插件可随时被用户禁用或卸载。
- 内置若干官方适配器（平台捕获规则）作为参考实现，用户插件与官方适配器使用相同 SDK。

分期：

| 子阶段 | 范围 |
| --- | --- |
| 10A | Worker Thread 沙箱 + 权能白名单 + 审计日志 + 插件 SDK |
| 10B | 若干内置官方适配器（作为 SDK 参考实现） |
| 10C | 插件管理 UI（安装、启用/禁用、权能审查、日志查看） |

改动范围：新增 `packages/plugin-core`（沙箱运行时、SDK 类型、权能模型）、`apps/api`（插件注册与生命周期接口）、`apps/web`（插件管理 UI）。

## Phase 11：社交场景生成工作台

状态：**规划中（内部候选版本稳定后启动）**。

目标：新增独立的 `social-studio`，桌面启动器显示「社交场景」、窗口标题显示「社交场景生成工作台」；让用户编辑社交内容数据并生成 PNG 或 MP4，与“网页合成工作台”的锁定网页预设、Slot 编辑和 iframe 捕获链路保持分离。

工作台形态：

- 窗口右上通过“场景”下拉切换微信对话、微信朋友圈、Telegram 对话等版本化场景；场景下再选择单聊、群聊、图文动态等模板。
- 左侧是随场景变化的内容编辑区，右侧是按目标尺寸缩放的实时预览；预览顶部集中提供格式、尺寸、时长和导出参数。
- 共享项目列表、草稿保存、素材选择、导出状态和历史；不把不同社交产品的业务字段强行压成一份万能表单。

MVP（`wechat.chat@1`）：

- 仅支持微信单聊：双方昵称/头像、会话标题、收发文字、图片消息、时间分隔和系统提示。
- PNG 支持当前屏幕与完整聊天长图；长图超出画布上限时明确提示并拆分导出，不静默裁剪。
- MP4 固定为消息按顺序出现、超出画面自动滚动的播放效果；提供 720p/1080p、30 fps 和最长 30 秒，不在首期提供逐条时间轴或转场编辑。

架构与边界：

- 在 `packages/contracts` 定义版本化 `SocialStudioProject`、`surfaceId/version`、场景专属文档、素材引用和导出设置；场景自行校验文档，公共层只管理项目、资源与导出。
- 预览与导出共用同一份社交界面渲染规则；PNG 和视频帧由项目数据绘制到离屏 Canvas，禁止把可见预览 DOM 截图作为成品来源。首期复用现有 Job、Asset、取消、日志和 ffmpeg 编码管道，产物默认写入 `/Workspace/Exports`。
- 素材只引用工作区资产或经 PathGrant 导入的资源，项目不保存裸物理路径；不接入真实账号、登录态或聊天记录导入。平台名称仅用于场景识别，主题资源与字体须独立治理并保留生成来源元数据。

分期：

| 子阶段 | 范围 |
| --- | --- |
| 11A | `social-studio` 应用壳、项目持久化、版本化场景注册、离屏渲染与统一导出接口 |
| 11B | `wechat.chat@1` 单聊编辑、聊天长图 PNG、自动播放 MP4 和桌面端验收 |
| 11C | 微信朋友圈、Telegram 对话及帖子类场景；按各自数据模型接入，不复用微信专属字段 |

---

> **远期可选（暂不承诺）**：MITM HTTPS 代理（动态 TLS 签发 + HTTP/2）——解决需要深度拦截的认证场景，但安全边界复杂，待 Phase 7 Cookie 路径验证不足时再评估。
