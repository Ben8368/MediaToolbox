# Roadmap

阶段计划放在这里，避免污染每轮必读的 [CONTEXT.md](../CONTEXT.md)。

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
- [x] Electron 生产打包基础链路：electron-builder 目录包、preload 生产路径、Web renderer 资源、本地 API 生产 runtime 与包内 `/api/health` 烟测已通过（macOS arm64 `--dir`）。
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

分期：

| 子阶段 | 范围 | 典型场景 |
| --- | --- | --- |
| 7A | Cookie 持久化与 yt-dlp 打通 | B站大会员、YouTube Premium、需登录的私有内容 |
| 7B | 多账号 session profile 管理 | 不同平台用不同登录态，账号切换不影响其他任务 |
| 7C | 捕获规则配置化 | URL 模式 → 通道路由（浏览器下载 / yt-dlp / 拒绝），JSON 规则热更新 |

改动范围：`apps/desktop`（session profile 管理）、`apps/api`（账号配置与规则接口）、`apps/web`（账号管理 UI）、`packages/downloader`（Cookie 注入逻辑）。不改变现有 worker 边界。

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

改动范围：新增 `packages/agent`（TypeScript，薄封装 LLM API）、`apps/api` 新增 `/api/agent/parse-url` 和 `/api/agent/parse-intent` 端点、`apps/web` 下载和批量任务入口增加 LLM 辅助入口。现有 worker 和 job 模型不变。
