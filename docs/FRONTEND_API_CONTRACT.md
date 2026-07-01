# Frontend API Contract

本文档记录 MediaToolbox 前端对接真实服务时的最小 API 契约。正式开发默认使用 `frontend/src/api/real/`；`frontend/src/mockApi/` 仅作为历史迁移参考和测试夹具保留。

## 1. 范围

前端负责：
- 表单输入
- 窗口与应用状态
- 任务列表展示
- 日志和系统状态展示
- 用户可见错误、空态和加载态

服务层负责：
- 真实媒体下载和处理
- 真实文件系统访问与安全边界
- 外部工具调用
- 日志持久化
- 系统指标采集

## 2. 通用约定

- 所有 API 错误返回用户可读 message
- 前端请求必须有超时和失败提示
- 文件路径和系统操作由服务层校验，前端不自行绕过安全边界
- 测试夹具响应结构应尽量贴近真实契约，避免组件感知数据来源

## 3. 端点概览

| 端点 | 用途 | 当前状态 |
| --- | --- | --- |
| `GET /api/system/metrics` | 右侧状态面板系统快照 | real |
| `GET /api/system/runtime` | 下载器状态栏网络速率 | real 骨架 |
| `POST /api/system/shutdown` | 关机 | real 骨架 |
| `GET /api/logs` | 日志列表 | real |
| `GET /api/logs/metadata` | 日志模块元数据 | real 骨架 |
| `DELETE /api/logs` | 清空日志 | real 骨架 |
| `GET /api/notifications/unread-count` | 未读通知数 | real 骨架 |
| `DELETE /api/notifications` | 清空通知 | real 骨架 |
| `POST /api/notifications/read-all` | 全部标为已读 | real 骨架 |
| `POST /api/fetch/tasks` | 提交下载任务 | real |
| `GET /api/fetch/tasks` | 活动任务列表 | real |
| `GET /api/fetch/tasks/history` | 历史任务 | real 骨架 |
| `POST /api/fetch/tasks/{id}/cancel` | 取消任务 | real |
| `DELETE /api/fetch/tasks/{id}` | 删除任务记录 | real |
| `POST /api/fetch/tasks/clear` | 批量清理记录 | real 骨架 |
| `GET /api/fetch/tasks/{id}/file` | 任务产出文件 URL | real 骨架 |
| `GET /api/filebrowser/workspace` | 工作区根路径 | real 骨架 |
| `PUT /api/filebrowser/workspace` | 设置工作区 | real 骨架 |
| `GET /api/filebrowser/disks` | 可浏览根目录 | real |
| `POST /api/filebrowser/list` | 列出目录 | real |
| `POST /api/filebrowser/mkdir` | 新建文件夹 | real 骨架 |
| `DELETE /api/filebrowser/path` | 删除/移入回收站 | real 骨架 |
| `GET /api/filebrowser/trash` | 回收站列表 | real 骨架 |
| `POST /api/filebrowser/trash/{id}/restore` | 恢复 | real 骨架 |
| `DELETE /api/filebrowser/trash/{id}` | 彻底删除单项 | real 骨架 |
| `DELETE /api/filebrowser/trash` | 清空回收站 | real 骨架 |

实现位置：
- real HTTP：`frontend/src/api/real/`
- 历史测试夹具：`frontend/src/mockApi/`

## 3.1 启用真实 API

在 `.env` 或构建环境中设置：

```env
VITE_API_BASE_URL=http://127.0.0.1:8080
```

应用启动时 `bootstrapApiClient()` 会调用 `setApiClient(realApi)`。默认不设置时仍使用真实 API；本地直连默认基址为 `http://127.0.0.1:8080`。

也可在代码中手动切换：

```typescript
import { setApiClient, realApi } from '@/api'
setApiClient(realApi)
```

## 4. 迁移规则

- 组件不直接判断当前数据来自真实服务还是测试夹具
- API 适配层负责把响应归一到组件需要的形状
- 未接入后端的能力，UI 不能承诺真实下载、真实文件读写或真实系统控制
- 切换实现：在应用启动时调用 `setApiClient(realApi)`，组件仍从 `@/api` 导入；契约见 `frontend/src/api/types.ts` 的 `MediaToolboxApi`
