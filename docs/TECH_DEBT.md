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

### 🔴 P0 — 正确性缺陷（0 项）

暂无。

---

### 🟡 P1 — 性能与可维护性（0 项）

暂无。

---

### 🟢 P2 — 设计层次问题（0 项）

暂无。

---

### 🟡 P1 — 从 CONTEXT.md 黄灯迁移（4 项）

#### TD-012: 浏览器 app 纯 Web 模式降级体验
- **位置：** `apps/web/src/apps/browser/`
- **来源：** CONTEXT.md 剩余黄灯
- **问题：** 浏览器 app 目前为单窗口 beta 能力；纯 Web 模式仅显示桌面端能力未连接提示
- **影响：** Web 模式用户无法使用浏览器能力，体验不完整
- **建议方案：** 设计 Web 模式下的降级方案（如代理模式、iframe 沙箱或明确引导用户切换到桌面端）
- **估算工作量：** 需要架构设计决策，10-20 行 UI 条件渲染

#### TD-013: 浏览器多标签页桌面端真机验收
- **位置：** `apps/desktop/src/browserViews.ts` + `apps/web/src/apps/browser/`
- **来源：** CONTEXT.md 剩余黄灯
- **问题：** 多标签页 UI 前端已接入，下载、权限和上传侧栏事件已按活动 `viewId` 展示，下载取消也校验 `viewId` 归属；但标签切换隐藏旧 view、view 生命周期与多标签下载体验仍待桌面端真机验收。
- **影响：** 桌面端真机多标签场景仍可能暴露 view 隐藏、销毁或焦点生命周期问题
- **建议方案：** 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），重点覆盖后台标签下载归属、权限提示和取消下载隔离。
- **估算工作量：** 主要是测试验收

#### TD-019: Electron 发布 polish
- **位置：** `apps/desktop/` + `.github/workflows/release.yml`
- **来源：** TD-014 偿还后的剩余发布项
- **问题：** Electron 目录包、preload 路径和本地 API 生产 runtime 已通过 macOS arm64 `--dir` 与包内 `/api/health` 烟测；桌面窗口/托盘图标入口、artifact 命名和 release preflight 已接入；但 macOS/Windows 签名、公证和完整安装包发布仍待验收
- **影响：** 当前可生成可运行目录包，且发布前置检查更明确；正式分发体验仍取决于签名、公证和跨平台安装包验收
- **建议方案：** 准备签名证书、公证凭据和 release tag 流程，运行 `npm run release:preflight` 后分别验收 `.dmg` / `.exe` / `.AppImage`
- **估算工作量：** 发布配置与证书准备为主

#### TD-015: PSD 真实 Photoshop 联调
- **位置：** `packages/psd-core/` + `workers/psd-worker/`
- **来源：** CONTEXT.md 剩余黄灯
- **问题：** PSD Photoshop adapter 已建立脚本命令边界；PSD 工作台已接入模板检查、manifest 编辑、批量渲染（仅文字 slot）和 manifest JSON sidecar 持久化；渲染输出路径已收口在工作区内，非文字 slot 现已显式拒绝避免静默忽略；但真实 Photoshop 本机命令路径、复杂 batchPlay 和 image/smart-object slot 渲染尚未联调
- **影响：** PSD 工作台目前只能处理文字 slot，无法处理图片和智能对象
- **建议方案：** 
  1. 配置真实 Photoshop 命令路径
  2. 验证 `POST /api/psd/render` 输出正确 PNG
  3. 实现 image/smart-object slot 渲染逻辑
  4. 联调复杂 batchPlay 命令
- **估算工作量：** Phase 5 深水区任务，20-50 行核心逻辑 + 真机联调

#### TD-016: macOS GPU 指标采集
- **位置：** `apps/api/src/system-sampler.ts`
- **来源：** CONTEXT.md 剩余黄灯
- **问题：** GPU 指标已接入 Windows/Linux NVIDIA、Windows 性能计数器回退和 macOS `ioreg IOAccelerator` 采样；仍待更多 macOS 机型和真实高负载场景验收
- **影响：** 当前 macOS 基础 GPU 利用率可显示，但跨机型输出格式差异可能导致降级
- **建议方案：** 
  1. 使用 Apple Silicon 与 Intel macOS 机器分别验收 `ioreg IOAccelerator`
  2. 如遇输出缺失，再评估 `powermetrics` 或 Metal API
  3. 记录不可用机型的降级文案
- **估算工作量：** 跨机型真机验证为主

---

## 已偿还债务（归档）

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
