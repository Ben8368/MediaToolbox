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
- 文件浏览骨架使用虚拟 `/Workspace` 路径；真实文件系统接入前，服务层已拒绝 `..`、磁盘盘符、UNC 和工作区外路径。
- 测试夹具响应结构应尽量贴近真实契约，避免组件感知数据来源。
- 跨模块共享类型逐步收敛到 `packages/contracts`。

## 3. 当前端点

| 端点 | 用途 | 当前状态 |
| --- | --- | --- |
| `GET /api/health` | 本地 API 健康检查 | 骨架 |
| `GET /api/apps` | 工作台应用列表 | 骨架 |
| `GET /api/system/metrics` | 右侧状态面板系统快照 | 骨架 |
| `GET /api/system/runtime` | 下载器状态栏网络速率 | 骨架 |
| `POST /api/system/shutdown` | 关闭本地服务，需 `x-mediatoolbox-shutdown: desktop` 请求头 | 骨架 |
| `GET /api/logs` | 日志列表 | 骨架 |
| `GET /api/logs/metadata` | 日志筛选元数据 | 骨架 |
| `DELETE /api/logs` | 清理日志 | 骨架 |
| `GET /api/notifications/unread-count` | 未读通知数量 | 骨架 |
| `DELETE /api/notifications` | 清理通知 | 骨架 |
| `POST /api/notifications/read-all` | 全部通知标为已读 | 骨架 |
| `POST /api/jobs` | 创建统一任务 | 骨架 |
| `GET /api/jobs` | 任务列表 | 骨架 |
| `GET /api/jobs/{id}` | 任务详情 | 骨架 |
| `POST /api/jobs/{id}/cancel` | 取消任务 | 骨架 |
| `POST /api/downloads/analyze` | 解析下载 URL | 待设计 |
| `POST /api/fetch/tasks` | 兼容迁回前端的下载任务提交 | 骨架 |
| `GET /api/fetch/tasks` | 兼容迁回前端的活动任务列表 | 骨架 |
| `GET /api/fetch/tasks/history` | 兼容迁回前端的历史任务 | 骨架 |
| `POST /api/fetch/tasks/{id}/cancel` | 取消兼容下载任务 | 骨架 |
| `DELETE /api/fetch/tasks/{id}` | 删除兼容下载记录 | 骨架 |
| `POST /api/fetch/tasks/clear` | 清理兼容下载记录 | 骨架 |
| `GET /api/fetch/tasks/{id}/file` | 兼容下载文件访问 | 骨架 |
| `GET /api/filebrowser/workspace` | 工作区信息 | 骨架 |
| `PUT /api/filebrowser/workspace` | 设置工作区 | 骨架 |
| `GET /api/filebrowser/disks` | 磁盘列表 | 骨架 |
| `POST /api/filebrowser/list` | 列出目录 | 骨架 |
| `POST /api/filebrowser/mkdir` | 新建文件夹 | 骨架 |
| `DELETE /api/filebrowser/path` | 删除/移入回收站 | 骨架 |
| `GET /api/filebrowser/trash` | 回收站列表 | 骨架 |
| `POST /api/filebrowser/trash/{id}/restore` | 恢复回收站条目 | 骨架 |
| `DELETE /api/filebrowser/trash/{id}` | 永久删除回收站条目 | 骨架 |
| `DELETE /api/filebrowser/trash` | 清空回收站 | 骨架 |
| `POST /api/transcode/jobs` | 创建转码任务，输入必须在工作区内，输出必须在 `/Workspace/Exports` 内 | 骨架 |
| `POST /api/transcode/jobs/{id}/cancel` | 取消转码任务 | 骨架 |
| `POST /api/psd/templates/inspect` | 检查 PSD 模版 slot | 待设计 |
| `POST /api/psd/batch-jobs` | 创建 PSD 批处理任务 | 待设计 |

实现位置：

- Web HTTP adapter：`apps/web/src/api/real/`
- 本地 API：`apps/api/src/`
- 共享契约：`packages/contracts`
- 历史测试夹具：`apps/web/src/mockApi/`

说明：状态为“骨架”的端点只保证请求/响应契约和前端联调通路，不代表真实下载、真实文件系统操作、系统指标采集或任务队列执行器已接入。

当前 `POST /api/fetch/tasks`、`POST /api/filebrowser/list`、`POST /api/filebrowser/mkdir`、`DELETE /api/filebrowser/path`、`PUT /api/filebrowser/workspace`、`POST /api/fetch/tasks/clear` 和 `POST /api/transcode/jobs` 已加入基础 Fastify schema。`POST /api/fetch/tasks/clear` 会同步清理对应 jobs 记录；`POST /api/fetch/tasks` 在兼容 `urls` 数组时，当前单任务执行器使用第一条 URL。后续接入真实执行器时，应继续补齐更细的业务字段校验和错误码约定。

文件浏览骨架的 `PUT /api/filebrowser/workspace` 会更新当前虚拟工作区状态，并重置骨架目录、文件和回收站；`POST /api/filebrowser/trash/{id}/restore` 会恢复对应内存条目；非空目录删除会被拒绝，避免产生不可达的子项。

## 4. 启用本地 API 契约模式

默认请求同源 `/api`。如果本地 API 不与前端同源，在 `apps/web/.env.local` 或构建环境中设置：

```env
VITE_API_BASE_URL=http://127.0.0.1:3701
```

说明：当前前端展示为“本地 API 契约模式”。这表示 HTTP 契约和骨架服务已启用，不表示真实下载、真实文件写入、真实系统指标或真实关机能力已经接入。

## 5. 迁移规则

- 组件不直接判断当前数据来自真实服务还是测试夹具。
- API 适配层负责把响应归一到组件需要的形状。
- 未接入后端的能力，UI 不能承诺真实下载、真实文件读写或真实系统控制。
- 从旧 `fetch/tasks` 契约迁移到统一 `jobs` 契约时，先兼容，再收敛。
- 端到端联调清单见 `docs/API_VALIDATION.md`。
