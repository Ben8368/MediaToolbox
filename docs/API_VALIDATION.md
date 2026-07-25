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
4. 下载、权限、上传和错误事件在侧栏中可读；若当前仍按窗口聚合，需在 `docs/TECH_DEBT.md` 记录活跃验收项，并仅在影响当前决策时于 `CONTEXT.md` 标记 ID 与摘要。

## PSD 路径

1. 未配置 Photoshop 命令 runner 时，PSD 模板检查返回可读错误。
2. 配置 runner 后检查工作区内 PSD，确认 slot 列表、画布尺寸和 sourcePath 可读。
3. 路径越界或 PSD 不存在时，前端显示可读提示。
4. `POST /api/psd/render` 使用工作区内 PSD 和文字 slot 输入时，输出 PNG 回写到 `/Workspace/Exports`。
5. 非文字必填 slot 或非文字 slot 输入返回 400 可读错误，不得静默忽略。
6. 客户端传入的 `__outputPath`、`__psdPath` 等 `__` 保留键不会影响服务端输出路径。
7. `POST /api/psd/manifests/save` 和 `GET /api/psd/manifests/load` 能完成 manifest sidecar 保存/加载往返。

## Web Composer 路径

1. 从桌面图标打开 `web-composer`，确认外框继承全局 `960×640` 默认尺寸和 `760×520` 最小尺寸；最小尺寸下预设、画布和左侧上下文 Inspector 仍可用，元素大纲与属性区独立滚动。
2. 在编辑模式依次点击预览中的文案、Logo、图标和背景，确认左栏切换到对应 Slot，并只显示 manifest 声明的文案、字体、设计字号、字重、颜色、Icon/图片/媒体替换、X/Y 偏移和显隐能力。
3. 隐藏一个 Slot，确认导出画布中不可见但仍可从元素大纲搜索、选择并恢复；切换到交互预览模式后，点击不再改变选择，预设原有按钮、链接和动画交互可用。
4. 切换全部 7 个预设，确认选中状态不会跨预设残留；多开工作台时，选择、坐标和捕获消息按 source、origin、session、预设 ID/版本隔离。
5. 切换 `16:9`、`9:16`、`1.91:1`、`1:1.91`、`4:3`、`3:4`、`1:1` 与分辨率，确认 iframe 的真实像素尺寸随设置变化，外层窗口只改变显示缩放，设计字号与偏移按画布比例呈现。
6. 勾选“去除背景”后，分别导出 7 个预设的 PNG；确认每张文件保留前景内容、背景 Slot 与 Trace Grid 背景遮罩均不出现，且在透明棋盘格查看器中显示 Alpha。未勾选时保持原有背景导出。
7. `POST /api/web-composer/exports/png` 返回 `web.render.image` job，成功后在 `/Workspace/Exports` 创建 PNG asset；选择框/Slot 标签不进入导出。错误签名、旧版/未知预设元组或超出 4K 总像素返回 400。
8. `POST /api/web-composer/exports/video` 返回 `web.render.video` job；默认 WebM 捕获经 worker 输出 H.264、`yuv420p`、faststart MP4。MP4 下拉中的透明 MOV 必须使用 VP9 Alpha 捕获并输出 ProRes 4444、`yuva444p10le` MOV；不支持 VP9 Alpha 的 Chromium 显示可读错误。取消与失败状态通过统一 jobs 可读。
9. 打开 `/preset/`，确认重定向到默认预设；使用顶部“选择预设”切换全部 7 个独立预览页，并检查全部 7 种画幅控件。
10. 删除或篡改一个本地基础视频或补充视频后运行素材 `ensure`，确认分别从固定 Release Asset 或固定上游 URL 恢复并通过大小与 SHA-256；下载不可用、哈希不匹配、捕获超时、浏览器不支持 MediaRecorder 或 ffmpeg 缺失时必须显示可读错误，不写入假成功 asset。
11. 预设源码或 CSS 被意外修改、manifest Slot 与默认状态/DOM 绑定不一致时测试失败；有意结构变更必须升级预设版本并更新来源 SHA/完整性锁。

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

联调完成后，在本文「验收记录」保留本地 API 地址与验收日期；仅在结果改变当前决策时更新 `CONTEXT.md`，阻断和跨任务验收项则链接至 `docs/TECH_DEBT.md`。

- 2026-07-13：本地备用端口完成 Web Composer beta 烟测。桌面入口、`960×640` 默认窗口、`760×520` 最小窗口、文案 Slot、`4:3` 的 `1440×1080` 画布均通过；PNG 成功写入 Exports；1 秒 MP4 经 ffprobe 确认为 H.264、`1920×1080`、`yuv420p`、时长 `1.000000` 秒；控制台无运行错误。
- 2026-07-14：默认字体/图片本地化、视频资源包本地打包/安装/逐文件校验、共享字体与视频 HTTP 200、renderer 入包 preflight、远端 Release 全新下载与 SHA-256 校验均通过；剩余黄灯仅保留 4K/15 秒压力与主观体验验收。
