# Architecture

MediaToolbox 采用桌面壳、Web UI、本地 API、任务系统、worker 和 adapter 分层。目标是保持小巧，但边界按长期项目设计。

## 分层

```text
apps/desktop  Electron 桌面壳，负责窗口、托盘、启动本地服务
apps/web      NAS 风格 React 前端，负责展示与交互
apps/api      本地 HTTP API，负责鉴权边界、任务编排、资产访问
workers/*     下载、转码、网页合成和 PSD 批处理等可隔离执行单元
packages/*    共享契约、状态机、adapter、数据库和 UI 工具
```

## 关键原则

- UI 不直接执行 `yt-dlp`、`ffmpeg`、Photoshop 或文件系统危险操作。
- API 只编排任务和管理本地资源，重活交给 worker。
- 第三方工具必须通过 adapter 包装，命令参数构建与进程执行分开。
- 所有长任务进入统一 Job 模型，支持进度、日志、取消与失败状态呈现。Job 持久化 `attempt`、`maxAttempts`、`nextAttemptAt` 和稳定 `outputToken`；下载与转码仅对 adapter 明确标记的暂时性错误执行最多 3 次的指数退避重试，等待期仍使用带调度时间的 `queued`。API 启动会将持久库遗留的活动任务安全标记为 `failed`、记录重启中断原因并吊销绑定授权；运行期 executor 由实例级 registry 跟踪，关闭时先取消排队下载、终止活动任务并等待清理完成，再关闭数据库。完整执行载荷和 checkpoint 尚未持久化，因此进程重启后不自动续跑。
- PSD 能力以模版 manifest 为中心，高保真编辑通过 Photoshop adapter 实现。
- Web Composer 以版本化 Slot v2 预设为中心；编辑器只写入 manifest 声明的 slot 与主题变量，预设 DOM、样式和动画源码保持只读并由完整性测试锁定。
- 浏览器网络能力由 Electron 主进程承载，其他 app 只能通过受控 API / IPC 调用，不直接读取 cookie、session 或本地文件。
- Electron 目录包中，renderer 由包内本地 API 同源托管；因此 SPA 路由、`/api` 和绝对静态资源共享 loopback origin，禁止回退到 `file://` 入口。

## 浏览器网络能力

浏览器 app 使用 Electron `WebContentsView` 承载真实网页，并通过 Browser Network adapter 提供可复用的浏览器网络能力基础。该能力用于处理需要网页登录态、跳转链、浏览器下载事件或用户手势的上传下载场景。

边界约定：

- `apps/desktop` 持有 Chromium session、权限策略、下载事件、弹窗策略和文件选择桥接；当前第一版已接管隔离 session、下载事件和默认拒绝的权限审计。
- `apps/api` 负责任务创建、权限校验、工作区路径约束、日志和统一 Job 状态；浏览器下载登记为 `browser.download` job。
- `apps/web` 只提交用户意图并展示状态，例如“使用当前浏览器会话下载”“上传工作区文件到当前页面”。
- 下载 app 后续采用双通道：普通浏览器下载走 Browser Network adapter；媒体解析、字幕提取、格式选择和后处理继续走 `yt-dlp` / worker adapter。详见 [YTDLP_CAPABILITY.md](YTDLP_CAPABILITY.md)。
- 所有下载写入受控工作区；所有上传来源必须经过工作区路径校验和用户确认。

## Workbench Apps

首批应用：

- 文件管理：资产浏览、预览、目录选择和回收站。
- 下载：视频、音频、字幕下载底层封装 `yt-dlp`；普通网页资源下载接入 Browser Network adapter 后再汇入下载 app 双通道策略。
- 转码：按预设调用 `ffmpeg`。
- PS：PSD 模版检查、slot 替换、批量导出，复杂场景接 Photoshop 自动化。
- Web Composer：在锁定网页预设上点击选择文案、Logo、图标或背景，由左侧上下文 Inspector 编辑声明的内容与样式能力，并按目标比例与分辨率导出 PNG、透明 PNG、MP4 或带 Alpha 的 MOV。
- 任务中心：统一任务队列、日志和历史。

Web Composer 使用独立同源 iframe 承载浏览器原生预设运行时。iframe 始终按目标像素尺寸渲染，工作台只缩放外层预览，不改写预设响应式结构；PNG/WebM 捕获在隔离运行时完成。PNG 可在捕获时隐藏每套预设的背景 Slot；透明 MOV 强制使用 VP9 WebM Alpha 捕获，并由 `web-render-worker` / ffmpeg 编码为 ProRes 4444（`yuva444p10le`）。API 校验捕获元数据与文件签名，输出文件名与 `/Workspace/Exports` 路径完全由服务端生成。

Web Composer 视频不进入源码 Git 对象。`assets/web-composer/manifest.json` 固定 8 个基础 MP4 的版本、Release URL、归档 SHA-256 和逐文件 SHA-256；`assets/web-composer/supplemental.json` 当前固定 3 个补充 MP4 的上游 HTTPS URL、大小和 SHA-256，不将其重新打入 Release 归档。字体、CSS 与必要图片仍随源码管理。根 `npm run dev`、`apps/web` 开发与构建生命周期先执行素材 `ensure`，本地有效时不访问网络，缺失时从对应固定来源安装到原静态 URL 目录；Electron renderer 构建产物仍必须包含完整视频，因此首次安装完成后预设与安装包保持离线能力。不可变 tag、授权记录、长期保留和回滚边界见 [ADR/0006-web-composer-external-video-assets.md](ADR/0006-web-composer-external-video-assets.md)。

Slot v2 与预览交互边界：

- `WebComposerPresetManifest.slots` 声明稳定 Slot ID、分组、可切换内容类型、可用编辑器、设计坐标偏移和显隐能力；`WebComposerPresetState.slots` 保存各 Slot 的候选内容、`activeKind`、`visible` 与偏移值，主题变量独立保存在 `theme`。
- 预设组件只为 manifest 中的 Slot 提供明确的 `data-wc-slot` 绑定；通用 Inspector 按 manifest 动态生成控件，不按预设 ID 编写分支，也不推断或开放任意 DOM。新增预设通过新增版本化 manifest、默认状态与显式绑定接入。
- 编辑模式下，iframe 将命中的 Slot 选择和设计坐标回传给工作台，左侧上下文 Inspector 仅展示当前元素能力；元素大纲提供搜索、分组和隐藏元素恢复入口。交互预览模式保留预设原有链接、按钮和动画行为。
- 每个工作台实例生成独立 `sessionId`。父窗口与 iframe 的消息同时校验 source、origin、session、预设 ID 与版本，避免多窗口、多 iframe 或旧预设消息串扰。
- hover/selection overlay 位于 capture root 之外并显式排除捕获；导出时捕获层只包含预设内容，选择框、Slot 标签和 Inspector 状态不得进入 PNG 或视频。

详见 [ADR/0005-web-composer-versioned-presets.md](ADR/0005-web-composer-versioned-presets.md)。

## 数据模型

- `AssetRecord`：视频、音频、字幕、图片、PSD、文件夹和导出结果。
- `JobRecord`：下载、转码、网页合成、PSD 批处理等长任务；执行次数、退避时间和幂等输出 token 属于共享契约。
- `PsdTemplateManifest`：PSD 模版、图层 slot、画布和导出约束。
- `WebComposerPresetManifest` / `WebComposerPresetState`：版本化 Slot v2 网页预设、类型化编辑能力、候选内容、显隐/设计坐标状态与主题变量。

共享类型位于 `packages/contracts`，任务状态机位于 `packages/job-core`。

## 工作区外路径授权

当前文件浏览默认将虚拟 `/Workspace` 映射到受控本地目录，`apps/api` 通过 `normalizeWorkspacePath()` 拒绝盘符、UNC 和 `..` 逃逸。该默认沙箱保持不变。

Phase 6 已引入 **PathGrant** 作为越界访问的唯一入口，与浏览器网络的「用户确认 + 权限审计」模式一致：

```text
用户选路（桌面原生 dialog）
  → apps/api 签发 grant（read 或 write）
  → 前端/任务只传 grantId
  → worker 经 grant 解析物理路径
  → job 结束或 TTL 到期后吊销
```

边界约定：

- `apps/web` 不持有、不拼接工作区外物理路径；只展示 grant 的 `displayName` 与授权状态。
- `apps/desktop` 负责 open/save dialog 与用户确认，向 API 提交规范化后的物理路径申请 grant。
- `apps/api` 负责签发、校验、绑定 job、吊销 grant，并写入审计日志；禁止信任客户端裸路径。
- worker 只消费 job 附带的 grant，不自行扩展搜索范围。
- 读授权与写授权分离；写入工作区外必须二次确认，且权限窄于读取。
- 当前已接入单文件读授权、单路径写授权和目录级读授权管道；桌面端真实体验仍按 `docs/API_VALIDATION.md` 跟进验收。
- PathGrant 通过 SQLite 条件更新原子领取：写授权（`file.write`）在真正落盘前消费为 `consumed`，不可重复使用；读授权首次绑定生命周期宿主后，其他任务不能复用。任务进入终态（成功/失败/取消）后自动吊销绑定授权，避免长期悬挂。
- PSD scan/apply 已进入统一异步 Job 模型；Photoshop adapter 接收 `AbortSignal` 并将取消下传到外部命令。外部 PSD 的读授权在 scan 后绑定工单 ID，以便 apply 复用，apply 结束或 scan 失败/取消后吊销。

详细分期与端点状态见 [ROADMAP.md](ROADMAP.md) Phase 6 与 [FRONTEND_API_CONTRACT.md](FRONTEND_API_CONTRACT.md) 安全边界章节。关键决策记录见 [ADR/0002-workspace-sandbox-and-pathgrant.md](ADR/0002-workspace-sandbox-and-pathgrant.md)。
