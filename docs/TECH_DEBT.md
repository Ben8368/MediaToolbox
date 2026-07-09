# 技术债追踪

> **用途：** 记录已识别但暂未修复的技术债，与 `AI_RULES.md` 红绿灯审查系统衔接。
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

新增债务仍按上方 P0/P1/P2 分级登记；当前无空队列占位，未偿还项集中在下方阶段黄灯迁移列表。

### 🟡 P1 — 从 CONTEXT.md 黄灯迁移（4 项）

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

#### TD-019: Electron 发布 polish
- **位置：** `apps/desktop/` + `.github/workflows/release.yml`
- **来源：** TD-014 偿还后的剩余发布项
- **目标阶段：** Release 候选构建前
- **阻断候选构建：** 是，若签名、公证或安装包验收失败
- **验证方式：** `npm run release:preflight` 后分别验收 `.dmg` / `.exe` / `.AppImage`
- **问题：** Electron 目录包、preload 路径和本地 API 生产 runtime 已通过 macOS arm64 `--dir` 与包内 `/api/health` 烟测；桌面窗口/托盘图标入口、artifact 命名和 release preflight 已接入；但 macOS/Windows 签名、公证和完整安装包发布仍待验收
- **影响：** 当前可生成可运行目录包，且发布前置检查更明确；正式分发体验仍取决于签名、公证和跨平台安装包验收
- **建议方案：** 准备签名证书、公证凭据和 release tag 流程，运行 `npm run release:preflight` 后分别验收 `.dmg` / `.exe` / `.AppImage`
- **估算工作量：** 发布配置与证书准备为主

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
- TD-014: Electron 生产打包工具链。已接入 API 生产 runtime bundle、packaged Electron `ELECTRON_RUN_AS_NODE` 启动、`userData` 工作区/DB 默认路径、electron-builder 目录包资源和 macOS arm64 包内 API health 烟测；剩余签名/图标/完整安装包发布项迁移为 TD-019。

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
- **CONTEXT.md：** P0 债务若影响阶段推进，应同步写入「当前阻断项」或「剩余黄灯」
- **LESSONS.md：** 债务偿还过程中的错误和经验应补充到压缩错题库
