# 技术债追踪

> **用途：** 记录已识别但暂未修复的技术债，与 [AI_RULES.md](AI_RULES.md) 红绿灯审查系统衔接。
>
> **原则：** 债务可控、优先级明确、偿还计划可视化。

## 债务分级

| 等级 | 含义 | 偿还优先级 |
| --- | --- | --- |
| 🔴 **P0** | 正确性缺陷，可能导致数据错误或崩溃 | 立即修复 |
| 🟡 **P1** | 性能问题或可维护性风险，影响用户体验 | 下个迭代 |
| 🟢 **P2** | 设计层次问题，未来扩展时需重构 | 长期规划 |

---

## 未偿还债务

新增债务仍按上方 P0/P1/P2 分级登记；当前无空队列占位，未偿还项集中在下方分级列表。

### 🔴 P0 — 候选构建阻断（1 项）

#### TD-019: Electron 打包态 renderer / API / 静态资源链路不可用
- **位置：** `apps/desktop/src/main.ts` + `apps/web/src/main.tsx` + `apps/web/src/api/http.ts` + `apps/web/src/icon-library/appIcons.ts` + `.github/workflows/release.yml` + `scripts/release-preflight.ts`
- **来源：** 全仓工程审查（2026-07-15）；承接 TD-014 偿还后的 Electron 候选构建验收
- **目标阶段：** 任何 Electron 内部候选构建前
- **阻断候选构建：** 是
- **验证方式：** 生成真实目录包并启动桌面窗口，确认根页面可见、renderer 能访问包内本地 API、图标/壁纸/Web Composer 视频可加载；在 Windows、macOS、Linux 至少各覆盖一个目标包，并把 renderer 功能烟测接入 release preflight 或 CI
- **问题：** 打包态使用 `file://.../renderer/index.html`，但前端使用 `BrowserRouter`，文件 pathname 无法命中 `/`；API 基址缺省为同源 `/api`，在 `file://` 下无法访问本地 Fastify；运行时仍有多处绝对 `/static/...`；release workflow 未建立可用的生产 API 通道，preflight 只检查文件存在。仅注入 `VITE_API_BASE_URL` 也不足以解决 `file://` 到 HTTP API 的跨源边界
- **影响：** 目录包可能启动主进程和 API 子进程，但 renderer 空白、API 不可达或主要静态资源缺失，不能据此宣称“可运行目录包”
- **建议方案：** 先确定统一的生产加载与 API 通道（例如同源 localhost 托管、受控自定义协议或 preload API bridge），再统一静态资源基址与路由策略；完成 renderer 功能烟测后再继续签名、公证和完整安装包验收
- **估算工作量：** 跨 desktop / web / API / release 的中等改造与三平台验收

### 🟡 P1 — 从 CONTEXT.md 黄灯与代码审查迁移（8 项）

#### TD-024: 下载器可见设置未进入 worker 契约
- **位置：** `apps/web/src/apps/DownloaderApp.tsx` + `apps/api/src/schemas.ts` + `apps/api/src/routes/fetch.ts` + `apps/api/src/download-executor.ts` + `apps/api/src/state.ts` + `packages/downloader/src/args.ts`
- **来源：** 全仓工程审查（2026-07-15）
- **目标阶段：** 下载器稳定版候选构建前
- **阻断候选构建：** 是，若保留当前输出目录、字幕、编码偏好和浏览器 Cookie 等可见设置
- **验证方式：** 以非默认输出目录、字幕、编码偏好、浏览器 Cookie 和批量并发值提交任务，断言共享请求契约、API 校验、worker job 与最终 yt-dlp 参数一致；覆盖不支持字段的显式 4xx 拒绝和批量并发上限
- **问题：** 前端提交 `output_dir`、字幕、编码偏好、`cookies_from_browser` 与 `max_concurrent` 等字段，schema 也接受并将其保存在 `task.params`，但 `buildDownloadJob()` 只消费 URL、mode 和固定输出模板；客户端提交的 `max_concurrent: 1` 被忽略，服务端使用 CPU 逻辑核数作为全局下载并发上限
- **影响：** 用户选择可能静默失效；批量任务在 16 核环境可同时启动 16 个 yt-dlp/ffmpeg 流程，造成错误预期和资源峰值
- **建议方案：** 将下载请求类型收敛到共享契约；支持的字段完整映射到安全的 worker 参数，不支持的字段显式拒绝或从 UI 移除；为全局与单批次并发建立有界、可配置的服务端策略
- **估算工作量：** contracts / schema / executor / downloader 参数构建与集成测试的中等改造

#### TD-025: Job 运行中进度被状态机自迁移拒绝
- **位置：** `packages/job-core/src/index.ts` + `apps/api/src/job-utils.ts` + `apps/api/src/transcode-executor.ts` + `apps/api/src/web-composer-executor.ts`
- **来源：** 全仓工程审查（2026-07-15）
- **目标阶段：** 转码与 Web Composer 视频候选构建前
- **阻断候选构建：** 是，若候选版本承诺可见的实时进度
- **验证方式：** 注入至少两个 worker 中间进度事件，轮询 Job 数据库并确认 `running` 状态不变且 progress/updatedAt 持续更新，最终再进入成功或取消状态
- **问题：** 进度回调调用 `running -> running`，但状态机不允许自迁移，`updateJobRecord()` 因而返回 `false`；当前调用方没有处理失败结果
- **影响：** 转码和 Web Composer 视频导出进度会长期显示 0，完成时突然跳到 100，且现有测试未覆盖该链路
- **建议方案：** 将“状态迁移”和“同状态字段 patch”拆成不同数据库入口，保留状态机约束的同时允许原子更新 progress/updatedAt；补 executor 到数据库再到系统指标响应的集成测试
- **估算工作量：** Job repository / executor 小到中等改造与回归测试

#### TD-026: Job 取消与完成之间缺少原子终态裁决
- **位置：** `apps/api/src/job-utils.ts` + `packages/db/src/database.ts` + `apps/api/src/download-executor.ts` + `apps/api/src/transcode-executor.ts` + `apps/api/src/web-composer-executor.ts` + `apps/api/src/routes/browser-network-model.ts`
- **来源：** 全仓工程审查（2026-07-15）
- **目标阶段：** 统一 Job 取消能力候选构建前
- **阻断候选构建：** 是，若候选版本承诺取消后不会产生成功记录或成功资产
- **验证方式：** 用可控 barrier 构造“worker 已完成但终态尚未写入”与“成功副作用执行前取消”两类竞态，断言数据库只有一个终态，`canceled` Job 不创建成功 Asset、不记录成功日志，内存下载任务与 Job 状态一致
- **问题：** 取消入口立即写入 `canceled`，执行器稍后仍可能完成；成功迁移被拒后，部分路径仍创建 Asset、写成功日志或把内存下载任务标成完成。Job repository 的更新只有 `WHERE id = ?`，没有基于旧状态的 compare-and-set
- **影响：** 同一任务可能同时表现为“已取消”和“已完成”，生成幽灵 Asset、错误成功日志或不一致的下载记录；绑定资源也可能早于真实进程结束被回收
- **建议方案：** 引入基于允许旧状态的原子 compare-and-set，或显式拆分 `cancel_requested` 与执行器终态；只有成功取得终态写入权后才能执行成功 Asset/日志等副作用，并为已产生的临时输出定义清理策略
- **估算工作量：** Job repository、各 executor 与 Browser Network 状态同步的中等改造

#### TD-023: Web Composer 默认视频来源与再分发授权
- **位置：** `assets/web-composer/` + `docs/RELEASE.md` + `SECURITY.md`
- **来源：** 源码/素材包分离治理审查（2026-07-14）
- **目标阶段：** 公开产品候选版本前
- **阻断候选构建：** 内部候选构建否；公开分发是
- **验证方式：** 为 8 个默认 MP4 逐项记录原始来源、版权方、许可证或书面再分发授权及兼容素材包版本，并确认仓库 `LICENSE` 与产品发布范围一致
- **问题：** 当前清单已固定归档与逐文件 SHA-256，但仓库没有可审计的逐项素材来源和再分发授权记录，也尚未选择项目公开许可证
- **影响：** 技术完整性可验证，但公开分发的版权与许可边界无法审计
- **建议方案：** 补齐逐文件 NOTICE/来源清单；无法确认授权的素材在公开候选版本前替换为自有或明确可再分发素材
- **估算工作量：** 资料确认与必要素材替换为主

#### TD-021: Web Composer 长时高分辨率验收
- **位置：** `apps/web/src/apps/web-composer/` + `workers/web-render-worker/`
- **来源：** Phase 5.5 beta 验收剩余黄灯
- **目标阶段：** Web Composer 候选版本前
- **阻断候选构建：** 是，若候选版本承诺离线或 4K/15 秒稳定导出
- **验证方式：** 三套预设分别覆盖默认素材、工作区图片、工作区视频，在 16:9/4:3/1:1/9:16 下完成 PNG 与 MP4；重点记录 4K/15 秒耗时、内存、文件体积和失败提示
- **问题：** 基础 PNG 和 1 秒 1080p H.264 MP4 已通过；字体已提升为 Web 前端共享资源，默认视频已迁移到固定 SHA-256 的版本化 Release Asset，远端全新安装已通过，但 4K/长时捕获基线仍待完成
- **影响：** 高规格视频导出可能较慢或触发捕获超时
- **建议方案：** 为高规格捕获建立分级预设、耗时提示和压力测试基线
- **估算工作量：** 资产治理与桌面压力验收为主

#### TD-012: 浏览器 app 纯 Web 模式降级体验
- **位置：** `apps/web/src/apps/browser/`
- **来源：** CONTEXT.md 剩余黄灯
- **目标阶段：** Phase 4.5 后续体验补齐
- **阻断候选构建：** 否
- **验证方式：** Web 模式手动打开浏览器 app，确认降级提示或替代路径可读且不可误操作
- **问题：** 浏览器 app 目前为单窗口 beta 能力；纯 Web 模式仅显示桌面端能力未连接提示
- **影响：** Web 模式用户无法使用浏览器能力，体验不完整
- **建议方案：** 设计 Web 模式下的降级方案（如代理模式、iframe 沙箱或明确引导用户切换到桌面端）
- **估算工作量：** 需要架构设计决策，10-20 行 UI 条件渲染

#### TD-013: 浏览器多标签页桌面端真机验收
- **位置：** `apps/desktop/src/browserViews.ts` + `apps/web/src/apps/browser/`
- **来源：** CONTEXT.md 剩余黄灯
- **目标阶段：** Phase 4.5 桌面端验收
- **阻断候选构建：** 是，若 view 生命周期或下载归属在真机失败
- **验证方式：** 桌面端真机覆盖新建/切换/关闭标签、后台下载归属、权限提示和取消下载隔离
- **问题：** 多标签页 UI 前端已接入，下载、权限和上传侧栏事件已按活动 `viewId` 展示，下载取消也校验 `viewId` 归属；但标签切换隐藏旧 view、view 生命周期与多标签下载体验仍待桌面端真机验收。
- **影响：** 桌面端真机多标签场景仍可能暴露 view 隐藏、销毁或焦点生命周期问题
- **建议方案：** 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），重点覆盖后台标签下载归属、权限提示和取消下载隔离。
- **估算工作量：** 主要是测试验收

#### TD-015: PSD 真实 Photoshop 联调
- **位置：** `packages/psd-core/` + `workers/psd-worker/` + `fixtures/psd/photoshop-workbench/`
- **来源：** CONTEXT.md 剩余黄灯
- **目标阶段：** Phase 5 深水区
- **阻断候选构建：** 是，若候选版本承诺 PSD 图片或智能对象渲染
- **验证方式：**
  1. 配置 `MEDIATOOLBOX_PHOTOSHOP_COMMAND` 指向本机 Photoshop
  2. 跑通 `npm run psd:roundtrip -- --fixture smoke --mode quick`（Quick 阈值：text/font 还原率 100%，size 漂移 ≤3%）
  3. 跑通 `npm run psd:roundtrip -- --fixture baseline --mode full`（Full 阈值：text 100%，font ≥90%，size ≤8%）
  4. 把通过后的 `comparison.json` 数值存入 `fixtures/psd/photoshop-workbench/` 作为回归基线
  5. 验证 `GET /api/psd/fonts` 返回真实字体列表
- **问题：** scan/apply/WorkOrder CRUD/list-fonts API 管道已完整实现，WorkOrder CRUD 与 list-fonts 已有 mock 集成测试（可进 CI）；但真实 Photoshop 本机命令路径、复杂 batchPlay 和 image/smart-object slot 渲染尚未联调
- **影响：** PSD 工作台目前只能处理文字 slot，无法处理图片和智能对象；往返还原率未经真机验证
- **建议方案：**
  1. 配置真实 Photoshop 命令路径，依次跑 smoke（quick）→ baseline（full）往返测试
  2. 锁定基线数值后，实现 image/smart-object slot 渲染逻辑
  3. 联调复杂 batchPlay 命令
- **估算工作量：** Phase 5 深水区任务，20-50 行核心逻辑 + 真机联调


### 🟢 P2 — 长期规划

#### TD-022: JobStatus.retrying 是预留死状态
- **位置：** `packages/contracts/src/index.ts`（`JobStatus` 类型）、`packages/job-core/src/index.ts`（状态转移表）、`apps/api/src/routes/system.ts`（过滤、can_cancel、状态标签）、`apps/web/src/apps/TranscodeApp.tsx`（展示文案）
- **来源：** 代码审查（2026-07-14），两份独立 review 报告共同指出
- **目标阶段：** 实现失败重试能力时一并处理，暂无阶段绑定
- **阻断候选构建：** 否
- **验证方式：** 若实现重试，需补充真正把 job 转入 `retrying` 再转回 `running`/`queued` 的集成测试；若决定移除，需确认 `packages/contracts`、`job-core`、`apps/api`、`apps/web` 四处引用同步清理且 `npm run verify` 通过
- **问题：** `JobStatus` 类型、`job-core` 的转移表（`running -> retrying`、`retrying -> queued/running/failed/canceled`）和前端展示文案都包含 `retrying`，但全仓库没有任何代码路径真正把 job 转换成这个状态——它只被读取（过滤活跃任务、判断可取消、状态标签翻译），从未被写入。`docs/ARCHITECTURE.md` 描述的"失败重试和恢复"目前对 `retrying` 状态而言是未实现的承诺。
- **影响：** 不影响现有功能正确性（没有代码依赖这个状态真的会被触发），但可能误导后续开发者以为重试机制已经存在
- **建议方案：** 两个选项均可：(a) 实现真正的重试机制，在 ffmpeg/yt-dlp/PSD 等 executor 失败时转入 `retrying` 并按策略退避重试；(b) 如果短期不打算做失败自动重试，从类型系统和展示代码中移除 `retrying`，回归到实际支持的状态集合。本轮暂不动代码，只记录决策留痕。
- **估算工作量：** 选项 (a) 属于中等功能开发；选项 (b) 是几行类型和过滤逻辑的清理

#### TD-020: PSD fixture 边界场景覆盖
- **位置：** `fixtures/psd/photoshop-workbench/`
- **来源：** PSD 工作台后端测试完善规划（2026-07-09）
- **目标阶段：** TD-015 真机联调通过后
- **阻断候选构建：** 否
- **验证方式：** 新增 fixture 文件能在 `psd:roundtrip` 各 mode 下正常完成往返
- **问题：** 现有 smoke.psd / baseline.psd 的图层结构需本机扫描后才能确认是否覆盖以下边界场景：Smart Object 深层嵌套（depth=3）、超长单行文字（宽度溢出 precheck 路径）、多行文字（subA/subB 收敛路径）、字体缺失降级路径
- **影响：** 若上述场景未覆盖，算法边界缺陷可能在真机联调后期才暴露
- **建议方案：** 在 TD-015 扫描 smoke/baseline 后，对缺失的边界场景补制对应 PSD fixture，并在 README 说明每个文件的设计意图
- **估算工作量：** 需要 Photoshop 操作，2-4 个新 PSD 文件 + 文档更新


---

## 已偿还债务（归档）

### 2026-07-08

- TD-016: macOS GPU 指标采集。`ioreg IOAccelerator` 已在 Apple Silicon（M 系列）机器上完成验收，GPU 利用率仪表在一般使用场景下显示正常；Intel Mac 跨机型验收跳过，当前降级文案（未检测到可用计数器）已足够。

### 2026-07-07

- TD-001: PowerShell 空输出误报 GPU 可用。已通过空输出解析保护修复，并补充单元测试。
- TD-002: `parseDataRateText` 无法匹配波浪号前缀。已支持 `~4.20MiB/s` 等 yt-dlp 预估速率格式。
- TD-003: `parseDataRateText` 接受不合法单位 `IB/s`。已改为枚举合法单位并补充测试。
- TD-004: `sampleGpu` 缓存击穿竞态。已加入 in-flight Promise 缓存，缓存过期瞬间复用同一次采样。
- TD-005: `parseDataRateText` 返回 0 无法区分解析失败。已改为 `number | null`，下载进度解析失败时不写入假 0 速率。
- TD-006: `buildMetrics` 串行执行独立异步操作。已改为并发采样内存与 GPU。
- TD-007: `sampleProjectNetworkRates` 两次遍历同一数组。已合并为单次 reduce。
- TD-008: `formatBytesPerSecond` 缺少 GB/s 支持。已新增 GB/s 显示分支。
- TD-009: `task.state` 对象频繁展开。已改为速率变化时才写入，解析失败时清理速率字段。
- TD-017: 前后端应用 ID 契约漂移。已将 `packages/contracts` 与 `/api/apps` 对齐到前端 registry（`browser`、`fetcher` 等），并补充 API 测试。
- TD-018: PSD manifest 类型重复且非文字 slot 会被隐式忽略。已将 PSD manifest/slot/render input 类型收敛到 `packages/contracts`，并在 API/worker/UI 明确当前仅支持文字 slot。
- TD-010: `formatBytesPerSecond` 与 `formatSpeed` 重复实现。已提取为 `packages/shared/utils/formatBytesPerSecond.ts` 统一实现，API 和 Web 端均改为引用共享包。
- TD-011: `cpuPrevious` 模块级全局状态。已将 CPU 采样状态封装为 `createCpuSampler()` 闭包，`sampleCpuPercent` 和 `resetCpuSamplerForTests` 保持原有公共 API 不变。
- TD-014: Electron 生产打包结构与 API 子进程链路。已接入 API production runtime bundle、packaged Electron `ELECTRON_RUN_AS_NODE` 启动、`userData` 工作区/DB 默认路径、electron-builder 目录包资源和 macOS arm64 包内 API health 烟测；该项只证明结构入包与 API 子进程可启动，不代表 renderer 功能可用，后续阻断迁移为 TD-019。

---

## 债务来源

- **代码审查：** `/code-review max` 自动识别
- **开发过程：** 红绿灯审查 🟡 黄灯项升级
- **用户反馈：** 生产环境问题复盘
- **重构规划：** 架构演进中的临时妥协

## 偿还流程

1. **识别 → 记录：** 发现债务后立即记录到本文档，标注优先级和预估工作量
2. **规划 → 认领：** 迭代规划时从 P0 → P1 → P2 顺序选择债务项，分配到对应的开发任务
3. **修复 → 验证：** 修复后必须包含对应测试用例，跑通 `npm run verify`
4. **归档 → 审计：** 移至「已偿还债务」，记录修复时间和 commit，供后续复盘

## 与现有体系的衔接

- **红绿灯审查：** 🔴 阻断项中的系统性问题可转为 P0 技术债，🟡 优化项中需跨任务跟进的内容可转为 P1/P2
- **[CONTEXT.md](../CONTEXT.md)：** P0 债务若影响阶段推进，应同步写入「当前阻断项」或「剩余黄灯」
- **[LESSONS.md](../LESSONS.md)：** 债务偿还过程中的错误和经验应补充到压缩错题库
