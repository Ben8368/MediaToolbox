# Real API Validation Checklist

本文档记录本地 API 与 worker 可用时的端到端验收清单。没有真实服务或真实执行器时，不得把这些项目标为完成。

## 前置条件

- 本地 API 服务已启动，并实现 `docs/FRONTEND_API_CONTRACT.md` 中的端点。
- 前端默认请求同源 `/api`；跨源联调时设置 `VITE_API_BASE_URL`。
- 浏览器控制台和 Network 面板无未解释的错误。

## 下载器路径

1. 提交单个下载任务，确认返回 `task_id`，列表出现任务。
2. 轮询活动任务，确认 `pending` / `running` / `completed` 等状态可读。
3. 取消可取消任务，确认状态刷新或错误提示可读。
4. 打开历史任务，确认完成、失败、取消记录可见。
5. 下载产出文件，确认 URL 由 `/api/fetch/tasks/{id}/file` 提供。
6. 后端返回错误、超时或空列表时，前端显示可读提示。

## 文件管理器路径

1. 加载工作区和磁盘列表，确认初始目录可打开。
2. 进入目录、返回、前进、上一级和刷新均可用。
3. 新建文件夹后刷新当前目录。
4. 删除到回收站、恢复、彻底删除和清空回收站均有可读结果。
5. 目录选择器初始化失败、目录为空或接口失败时，前端显示可读状态。

## 转码路径

1. 使用 `/Workspace` 内输入路径和 `/Workspace/Exports` 内输出路径提交转码任务，确认返回 `media.transcode` job。
2. 轮询统一 jobs，确认排队、运行、完成或失败状态可读。
3. 取消可取消任务，确认状态刷新或错误提示可读。
4. 输入路径越界、输出目录不在 `/Workspace/Exports` 或 ffmpeg 缺失时，前端显示可读提示。

## 浏览器网络路径

1. 浏览器资源下载入口创建 Browser Network 下载任务，并写入 `/Workspace/Downloads`。
2. Electron `will-download` 登记的下载 ID 能稳定回写进度、完成、失败和取消状态。
3. 下载失败、取消或被安全边界拒绝时，浏览器 app、下载 app 或任务中心显示可读提示。
4. 工作区上传选择只允许工作区内文件，并在桌面端确认。
5. 权限允许、拒绝和取消均写入日志审计。
6. 浏览器错误页 overlay 显示错误文案，重试按钮能重新触发加载。

## 浏览器多标签页路径

1. 新建标签页会创建独立 `viewId`，地址、加载状态和错误状态互不覆盖。
2. 切换标签页时，活动标签独占原生 `WebContentsView`，旧 view 被隐藏而非继续覆盖窗口。
3. 关闭标签页会销毁对应 view，并拒绝关闭最后一个标签。
4. 下载、权限、上传和错误事件在侧栏中可读；若当前仍按窗口聚合，需在 `CONTEXT.md` 或 `docs/TECH_DEBT.md` 标记剩余黄灯。

## PSD 路径

1. 未配置 Photoshop 命令 runner 时，PSD 模板检查返回可读错误。
2. 配置 runner 后检查工作区内 PSD，确认 slot 列表、画布尺寸和 sourcePath 可读。
3. 路径越界或 PSD 不存在时，前端显示可读提示。
4. `POST /api/psd/render` 使用工作区内 PSD 和文字 slot 输入时，输出 PNG 回写到 `/Workspace/Exports`。
5. 非文字必填 slot 或非文字 slot 输入返回 400 可读错误，不得静默忽略。
6. 客户端传入的 `__outputPath`、`__psdPath` 等 `__` 保留键不会影响服务端输出路径。
7. `POST /api/psd/manifests/save` 和 `GET /api/psd/manifests/load` 能完成 manifest sidecar 保存/加载往返。

## 系统状态路径

1. `GET /api/system/metrics` 的 CPU / 内存 / GPU 值能在右侧状态面板刷新。
2. Windows/Linux NVIDIA 或 Windows 性能计数器回退路径可用时，GPU 仪表不显示假成功。
3. macOS Apple Silicon GPU 采样可用时显示真实采样；不可用或不支持的机型显示可读降级状态，不写入假成功。

## 工作区外路径授权路径（Phase 6，已接入，待验收）

> 管道已接入；未跑完下列真实路径前，不得把桌面端体验验收标为完成。

1. 未携带 grant 时，裸盘符/UNC 路径仍被 API 拒绝。
2. 桌面 open dialog 选外部文件后签发 read grant，转码/PSD 任务可通过 `inputGrantId` 读取该文件。
3. 写入 `/Workspace/Exports` 不需要 write grant；写入工作区外路径必须二次确认并签发 write grant。
4. grant 过期或 job 完成后不可再次使用；审计日志可追溯授权事件。
5. 纯 Web 模式有明确降级提示。
6. 目录级授权浏览只暴露用户选定目录范围，不扩大为整盘永久挂载。

## 验收记录

联调完成后，在 `CONTEXT.md` 中记录本地 API 地址、验收日期、阻断项和剩余黄灯。
