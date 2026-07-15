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

### 🟡 P1 — 从 CONTEXT.md 黄灯与代码审查迁移（6 项）

#### TD-019: Electron 目录包跨平台 renderer 功能烟测
- **位置：** `apps/desktop/src/main.ts` + `apps/api/src/renderer-routes.ts` + `.github/workflows/release.yml` + `scripts/release-preflight.ts`
- **来源：** 全仓工程审查（2026-07-15）；原 P0 代码阻断已修复
- **目标阶段：** Electron 候选发布前
- **阻断候选构建：** 是，直至完成三平台真实目录包验收
- **已完成：** 打包态 renderer 改为本地 Fastify 同源托管；生产窗口加载 `apiUrl`；API 提供静态资源与 SPA fallback；自动化覆盖根页面、预设路由、静态 JS、真实 `/api/health`、运行时资源路径与 API 启动环境。Release workflow 现由三平台 matrix 分别构建、启动真实目录包并检查根页面、同源 API、图标与代表性 Web Composer 视频；三个 job 全部通过后，单一 `publish` job 才汇总产物、执行公开分发授权门禁并发布，禁止三个 runner 并发改写同一 Release。
- **剩余验证：** 等待下一次 tag Release 在 Windows、macOS、Linux runner 实际跑通该门禁，并验证单一发布 job 的产物汇总；签名、公证与人工安装体验另按发布流程验收。
- **影响：** 在该 workflow 首次成功前，不能宣称三平台候选包已实际运行。
- **估算工作量：** 主要为首次三平台 CI 验收与后续签名/安装体验确认。

#### TD-023: Web Composer 默认视频来源与再分发授权
- **位置：** `assets/web-composer/` + `docs/RELEASE.md` + `SECURITY.md`
- **来源：** 源码/素材包分离治理审查（2026-07-14）
- **目标阶段：** 公开产品候选版本前
- **阻断候选构建：** 内部候选构建否；公开分发是
- **验证方式：** 为 8 个默认 MP4 逐项记录原始来源、版权方、许可证或书面再分发授权及兼容素材包版本，并确认仓库 `LICENSE` 与产品发布范围一致
- **问题：** 当前清单已固定归档与逐文件 SHA-256，但仓库没有可审计的逐项素材来源和再分发授权记录，也尚未选择项目公开许可证
- **影响：** 技术完整性可验证，但公开分发的版权与许可边界无法审计
- **建议方案：** 补齐根 `LICENSE` 和 `assets/web-composer/PROVENANCE.json` 逐文件来源清单；无法确认授权的素材在公开候选版本前替换为自有或明确可再分发素材。`npm run release:preflight:public` 与 tag Release 的单一发布 job 已将两项证据设为硬门禁。
- **估算工作量：** 资料确认与必要素材替换为主

#### TD-021: Web Composer 长时高分辨率验收
- **位置：** `apps/web/src/apps/web-composer/` + `workers/web-render-worker/`
- **来源：** Phase 5.5 beta 验收剩余黄灯
- **目标阶段：** Web Composer 候选版本前
- **阻断候选构建：** 是，若候选版本承诺离线或 4K/15 秒稳定导出
- **验证方式：** 三套预设分别覆盖默认素材、工作区图片、工作区视频，在 16:9/4:3/1:1/9:16 下完成 PNG 与 MP4；4K 明确定义为 UHD `3840×2160`（不是 DCI `4096×2160`），重点记录 15 秒导出耗时、峰值内存、文件体积和失败提示
- **问题：** 基础 PNG 和 1 秒 1080p H.264 MP4 已通过；字体已提升为 Web 前端共享资源，默认视频已迁移到固定 SHA-256 的版本化 Release Asset，远端全新安装已通过，但 4K/长时捕获基线仍待完成
- **影响：** 高规格视频导出可能较慢或触发捕获超时
- **建议方案：** 为高规格捕获建立分级预设、耗时提示和压力测试基线
- **估算工作量：** 资产治理与桌面压力验收为主

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


#### TD-028: Job 可重试调度与安全关闭屏障
- **位置：** `apps/api/src/job-recovery.ts` + `apps/api/src/*-executor.ts` + `packages/job-core/`
- **来源：** 全仓技术债复核（2026-07-15）
- **目标阶段：** 长任务可靠性迭代
- **阻断候选构建：** 否；若承诺进程重启后自动续跑则是
- **已完成：** 所有服务端 Job ID 已统一为带业务前缀的 UUID；API 启动会将 SQLite 遗留的 `queued` / `running` / `paused` 孤儿任务原子标记为 `failed`，写入明确中断原因和审计日志，并吊销绑定 PathGrant。
- **剩余问题：** 当前仍不自动重试、没有 attempt/checkpoint/幂等输出 token；Fastify 关闭也没有等待所有 executor 停止后再关闭数据库的统一屏障。
- **影响：** API 重启后不会继续显示永久运行中的假任务，但用户仍需手动重提；直接引入关库 hook 会与异步 executor 收尾竞争。
- **建议方案：** 先建立 executor registry 与 graceful drain，再设计 `attempt`、`maxAttempts`、`nextAttemptAt`、错误分类、指数退避和幂等 Asset 提交；不得恢复没有调度语义的 `retrying` 伪状态。
- **估算工作量：** 中等，需要数据库契约、调度器、executor 和重启/关闭集成测试协同修改。

### 🟢 P2 — 长期规划

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

### 2026-07-15

- TD-029: Web Composer 预设页 logo/icon slot PNG 替换失败。已新增 `replaceSlotWithImage`，上传图片会同时更新 image 候选并切换 `activeKind: 'image'`；Lumora 文案型 Logo 与 VaultShield 图标型 Logo 的状态层回归、Lumora 渲染 `<img>` 回归已覆盖，避免继续显示默认文案或内置图标。
- TD-027: 所有服务端 Job ID 与 PSD workorder ID 已改用带业务前缀的 UUID；同一冻结时钟下并发创建 100 个任务均成功且 ID 唯一，消除时间戳/数组长度碰撞导致的 SQLite 主键冲突。
- Release matrix 并发发布风险已修复：三平台仅构建、烟测和上传 workflow artifact，单一 `publish` job 在全部通过后创建草稿、上传完整产物并转为正式 Release；已发布 tag 禁止覆盖。
- TD-012: 纯 Web 模式下，浏览器 app 现在明确说明 Electron 会话边界，并提供“打开下载器”的可用替代路径；用户不会再被留在无法操作的空浏览器界面。
- TD-022: 移除了没有任何执行路径的 `JobStatus.retrying`、状态转移、指标过滤与前端展示；失败自动重试改为未来显式设计的调度能力，而非伪装成已支持状态。
- TD-024: 下载请求已收敛为共享 `FetchTaskDraft`。工作区输出目录、H.264/转码、Cookie 与有界批次并发都映射到调度器或 yt-dlp 参数；平台、通道和字幕策略统一自动处理，字幕仅请求原始语言的一份 SRT。未知字段和超界并发返回 4xx，服务端全局并发上限为 4。已补 API 与 downloader 回归测试。
- TD-025: Job 运行中字段更新已从状态迁移中拆出，`patchIfStatus(..., 'running')` 原子持久化进度与更新时间；Browser Network 进度回归测试确认状态保持 `running`。
- TD-026: Job 终态写入改为基于旧状态的数据库 compare-and-set。成功 Asset/日志仅在成功领取 `succeeded` 后创建；取消后到达的浏览器完成事件会保持 `canceled` 且不生成 Asset。已补竞态回归测试。

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
