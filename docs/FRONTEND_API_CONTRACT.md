# Frontend API Contract

本文档记录 `apps/web` 对接 `apps/api` 时的最小 API 契约。正式开发默认使用 `apps/web/src/api/real/` 访问同源 `/api`；跨源联调时使用 `VITE_API_BASE_URL`。

## 1. 范围

前端负责：

- 表单输入
- 窗口与应用状态
- 任务列表展示
- 日志和系统状态展示
- 用户可见错误、空态和加载态

本地 API 负责：

- 任务创建、查询、取消、重试和历史
- 资产索引和安全路径边界
- worker 调度和执行状态汇总
- 第三方 adapter 的统一入口
- 日志持久化和系统指标采集

Workers / adapters 负责：

- `yt-dlp` 下载、字幕和音频提取
- `ffmpeg` / `ffprobe` 探测与转码
- PSD 模版处理和 Photoshop 自动化桥接

## 2. 通用约定

- 所有 API 错误返回用户可读 `message`。
- 本地 API 统一错误响应为 `{ ok: false, message }`；schema 校验失败返回 400。
- 前端请求必须有超时和失败提示。
- 文件路径和系统操作由服务层校验，前端不自行绕过安全边界。
- 文件浏览对外仍使用虚拟 `/Workspace` 路径；服务层会映射到受控本地工作区目录，并拒绝 `..`、磁盘盘符、UNC 和工作区外路径。
- 测试夹具响应结构应尽量贴近真实契约，避免组件感知数据来源。
- 跨模块共享类型逐步收敛到 `packages/contracts`。

## 3. 当前端点

| 端点 | 用途 | 当前状态 |
| --- | --- | --- |
| `GET /api/health` | 本地 API 健康检查 | 骨架 |
| `GET /api/apps` | 工作台应用列表；应用 ID 与前端 registry 对齐为 `browser`、`file-manager`、`fetcher`、`transcode`、`ps`、`settings`、`logs` | 骨架 |
| `GET /api/system/metrics` | 右侧状态面板系统快照 | 本地采样 |
| `GET /api/system/runtime` | 下载器状态栏网络速率 | 本地采样 |
| `POST /api/system/shutdown` | 关闭本地服务，需 `x-mediatoolbox-shutdown: desktop` 请求头 | 骨架 |
| `GET /api/logs` | 日志列表 | SQLite |
| `GET /api/logs/metadata` | 日志筛选元数据 | SQLite |
| `DELETE /api/logs` | 清理日志 | SQLite |
| `GET /api/notifications` | 通知列表（WARNING/ERROR/CRITICAL） | SQLite |
| `GET /api/notifications/unread-count` | 未读通知数量 | SQLite + settings |
| `DELETE /api/notifications` | 清理通知 | SQLite settings |
| `POST /api/notifications/read-all` | 全部通知标为已读 | SQLite settings |
| `POST /api/jobs` | 创建统一任务 | SQLite |
| `GET /api/jobs` | 任务列表 | SQLite |
| `GET /api/jobs/{id}` | 任务详情 | SQLite |
| `POST /api/jobs/{id}/cancel` | 取消任务 | 状态联动 |
| `GET /api/assets` | 文件库资产索引，汇总浏览器下载、转码和后续 PSD 产出 | SQLite |
| `GET /api/browser-network/downloads` | 浏览器下载记录列表 | 本地状态 + jobs |
| `GET /api/browser-network/downloads/{id}` | 浏览器下载记录详情 | 本地状态 + jobs |
| `POST /api/browser-network/downloads` | 桌面端登记 Electron 浏览器下载，需 `x-mediatoolbox-browser-network: desktop`；桌面端传入的 `id` 会作为下载记录和 job 的稳定 ID | 执行入口 |
| `PATCH /api/browser-network/downloads/{id}` | 桌面端更新浏览器下载进度、完成、失败或取消，需桌面标记 | 状态联动 |
| `POST /api/browser-network/downloads/{id}/cancel` | 桌面端同步浏览器下载取消状态，需桌面标记 | 状态联动 |
| `POST /api/browser-network/permission-events` | 桌面端写入浏览器权限审计，需桌面标记 | SQLite 日志 |
| `POST /api/downloads/analyze` | 解析下载 URL 并给出 yt-dlp / Browser Network 双通道策略 | 策略分析 |
| `POST /api/fetch/tasks` | 兼容迁回前端的下载任务提交；多 URL 会拆分为多任务并返回 `task_ids` | 执行入口 |
| `GET /api/fetch/tasks` | 兼容迁回前端的活动任务列表 | 本地状态 |
| `GET /api/fetch/tasks/history` | 兼容迁回前端的历史任务 | 本地状态 |
| `POST /api/fetch/tasks/{id}/cancel` | 取消兼容下载任务 | 状态联动 |
| `DELETE /api/fetch/tasks/{id}` | 删除兼容下载记录 | 本地状态 |
| `POST /api/fetch/tasks/clear` | 清理兼容下载记录 | 本地状态 |
| `GET /api/fetch/tasks/{id}/file` | 兼容下载文件访问，仅返回任务记录的工作区产物 | 工作区文件返回 |
| `GET /api/filebrowser/workspace` | 工作区信息 | 本地映射 |
| `PUT /api/filebrowser/workspace` | 设置工作区 | 本地映射 |
| `GET /api/filebrowser/disks` | 磁盘列表 | 本地映射 |
| `POST /api/filebrowser/list` | 列出目录 | 本地映射 |
| `POST /api/filebrowser/mkdir` | 新建文件夹 | 本地映射 |
| `DELETE /api/filebrowser/path` | 删除/移入回收站 | 本地映射 |
| `GET /api/filebrowser/trash` | 回收站列表 | 本地映射 |
| `POST /api/filebrowser/trash/{id}/restore` | 恢复回收站条目 | 本地映射 |
| `DELETE /api/filebrowser/trash/{id}` | 永久删除回收站条目 | 本地映射 |
| `DELETE /api/filebrowser/trash` | 清空回收站 | 本地映射 |
| `POST /api/transcode/jobs` | 创建转码任务，输入必须在工作区内，输出必须在 `/Workspace/Exports` 内 | 执行入口 |
| `POST /api/transcode/jobs/{id}/cancel` | 取消转码任务 | 状态联动 |
| `POST /api/psd/templates/inspect` | 检查 PSD 模版 slot，需配置 Photoshop 命令 runner；未配置返回 503 可读错误 | 执行入口 |
| `POST /api/psd/render` | 渲染 PSD 模版；`template.sourcePath` 必须在工作区内，输出由服务端固定生成到 `/Workspace/Exports`，回写虚拟路径。当前仅支持 `text` slot，非文字必填 slot 或非文字 slot 输入会返回 400 可读错误。**客户端传入的 `__` 保留键（`__outputPath`/`__psdPath` 等）一律被剥离**，前端不得依赖它们指定路径 | 执行入口 |
| `POST /api/psd/manifests/save` | 保存 manifest JSON sidecar 到 PSD 同目录（`<psd>.manifest.json`）；`sourcePath` 必须在工作区内，持久化时规范化为虚拟路径 | 本地映射 |
| `GET /api/psd/manifests/load` | 读取已保存的 manifest sidecar；无 sidecar 返回 404 可读错误 | 本地映射 |
| `POST /api/psd/batch-jobs` | 创建 PSD 批处理任务 | 待设计 |

`GET /api/system/metrics` 的 `system.memory_percent` 表示右侧状态面板的内存仪表值：macOS 优先使用 `memory_pressure -Q` 推导系统内存压力，其他平台回退为物理内存占用比例；`memory_used_bytes`、`memory_total_bytes` 和 `memory_free_bytes` 保留原始物理内存明细。

实现位置：

- Web HTTP adapter：`apps/web/src/api/real/`
- 本地 API：`apps/api/src/`
- 共享契约：`packages/contracts`
- 历史测试夹具：`apps/web/src/mockApi/`

说明：

- 状态为“骨架”的端点只保证请求/响应契约和前端联调通路，不代表真实能力已完整接入。
- 状态为“本地映射”的文件浏览端点会操作服务端受控工作区目录；默认目录为仓库 `.tmp/workspace`，可通过 `MEDIATOOLBOX_WORKSPACE_DIR` 覆盖。
- 系统指标当前采样 uptime、CPU、内存、项目任务网络速率和 GPU；网络速率统计 MediaToolbox 浏览器下载、浏览器请求与 yt-dlp 任务流量，GPU 采样覆盖 Windows/Linux NVIDIA、Windows GPU 计数器回退，macOS GPU 仍待补齐。

已接入的 schema 与状态联动：

- 下列端点已加入基础 Fastify schema：
  - 下载：`POST /api/fetch/tasks`、`POST /api/fetch/tasks/clear`、`GET /api/fetch/tasks/{id}/file`
  - 文件浏览：`POST /api/filebrowser/list`、`POST /api/filebrowser/mkdir`、`DELETE /api/filebrowser/path`、`PUT /api/filebrowser/workspace`
  - 转码与 PSD：`POST /api/transcode/jobs`、`POST /api/psd/templates/inspect`
  - 浏览器网络写入端点
- `POST /api/fetch/tasks/clear` 会同步清理对应 jobs 记录；`POST /api/fetch/tasks` 兼容 `urls` 数组，按 URL 拆分为多个下载任务和 jobs，并把 yt-dlp 产物固定写入工作区 `Downloads`。
- `POST /api/jobs/{id}/cancel` 会联动下载/转码 abort controller，并可标记浏览器下载 job 取消状态。
- `GET /api/assets` 为文件库提供 SQLite 资产索引；`DELETE /api/logs` 会清空 SQLite 日志；通知未读数从 WARNING/ERROR/CRITICAL 日志派生，并通过本地已读时间点归零。

安全边界：

- `GET /api/fetch/tasks/{id}/file` 只返回任务记录的工作区产物，避免按任意路径绕过文件边界。
- 浏览器网络下载由 Electron 主进程接管 `will-download` 后登记为 `browser.download` job，只允许写入 `/Workspace/Downloads`，并将桌面端下载 ID 作为后续进度、取消和完成回写的稳定记录 ID。
- 受控上传文件选择只允许工作区内文件并在桌面端确认，权限请求写入日志审计。
- PSD manifest、slot 与渲染输入类型收敛到 `packages/contracts`；`POST /api/psd/render` 与转码输出同一约束：源模版必须落在工作区内，输出路径**完全由服务端在 `/Workspace/Exports` 内生成**。
- 服务端会剥离客户端传入的 `__outputPath`、`__psdPath` 等 `__` 保留键，杜绝任意文件写入或读取工作区外 PSD；非文字 slot 当前会明确拒绝，避免静默忽略。

后续接入真实执行器时，应继续补齐更细的业务字段校验和错误码约定。

文件浏览端点会更新当前虚拟工作区到本地目录的映射，并通过 `.trash` 子目录实现回收站；非空目录删除会被拒绝，避免误删整棵目录。

## 4. 启用本地 API 契约模式

默认请求同源 `/api`。如果本地 API 不与前端同源，在 `apps/web/.env.local` 或构建环境中设置：

```env
VITE_API_BASE_URL=http://127.0.0.1:3701
```

说明：当前前端展示为“本地 API 契约模式”。这表示 HTTP 契约和部分本地能力已启用；文件浏览、浏览器下载登记、权限审计、受控上传确认流、日志清理、通知已读、统一任务取消、基础系统采样、项目任务网络速率、Windows/Linux NVIDIA GPU 与 Windows GPU 计数器回退已接入，但不表示 macOS GPU 指标、Electron 生产打包、PSD image/smart-object slot 和 Photoshop 本机联调已经完整完成。

## 5. 迁移规则

- 组件不直接判断当前数据来自真实服务还是测试夹具。
- API 适配层负责把响应归一到组件需要的形状。
- 未接入后端的能力，UI 不能承诺真实下载、真实文件读写或真实系统控制。
- 从旧 `fetch/tasks` 契约迁移到统一 `jobs` 契约时，先兼容，再收敛。
- 端到端联调清单见 `docs/API_VALIDATION.md`。
