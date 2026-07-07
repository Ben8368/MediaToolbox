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

### 🔴 P0 — 正确性缺陷（5 项）

#### TD-001: PowerShell 空输出误报 GPU 可用
- **位置：** `apps/api/src/system-sampler.ts:123`
- **发现时间：** 2026-07-07
- **问题：** Windows GPU 计数器不存在时，PowerShell 返回空字符串 → `Number('')` 为 0（而非 NaN）→ 误报 GPU 利用率 0% 可用
- **影响：** 无 GPU 机器显示"GPU 可用且利用率 0%"，误导用户
- **建议方案：** 检查 `stdout.trim().length === 0` 时直接返回 `undefined`
- **估算工作量：** 1 行修复 + 1 个测试用例

#### TD-002: parseDataRateText 无法匹配波浪号前缀
- **位置：** `apps/api/src/system-sampler.ts:137`
- **发现时间：** 2026-07-07
- **问题：** yt-dlp 输出 `~4.20MiB/s`（预估速率）时，正则 `/^[\d.]+/` 要求开头必须是数字，导致解析失败返回 0
- **影响：** 下载任务网络速率显示为 0，用户误判停滞
- **建议方案：** 正则改为 `/^~?([\d.]+)\s*([KMGT]?i?B)\/s$/i`，支持可选波浪号前缀
- **估算工作量：** 1 行修复 + 2 个测试用例

#### TD-003: parseDataRateText 接受不合法单位 'IB/s'
- **位置：** `apps/api/src/system-sampler.ts:146`
- **发现时间：** 2026-07-07
- **问题：** 输入 `'10 IB/s'`（无 K/M/G/T 前缀的 I 单位）被错误解析为 10 bytes/s
- **影响：** 异常格式数据未被拒绝，可能掩盖 yt-dlp 输出异常
- **建议方案：** 二进制单位 `i` 必须与 K/M/G/T 配对，否则返回 0；或调整正则为 `/^~?([\d.]+)\s*([KMGT]i?B|B)\/s$/i`（明确枚举合法单位）
- **估算工作量：** 3-5 行逻辑调整 + 3 个测试用例

#### TD-004: sampleGpu 缓存击穿竞态
- **位置：** `apps/api/src/system-sampler.ts:66`
- **发现时间：** 2026-07-07
- **问题：** 多个并发 `/api/system/metrics` 请求在缓存过期瞬间同时通过检查 → 启动多个 PowerShell/nvidia-smi 进程（3.5s/1.5s 超时）
- **影响：** 高并发场景下（多标签页刷新指标）CPU 和系统资源浪费
- **建议方案：** 引入 in-flight 标志或 Promise 缓存，首个请求发起后续请求等待同一个 Promise
- **估算工作量：** 10-15 行重构 + 并发测试用例

#### TD-005: parseDataRateText 返回 0 无法区分解析失败
- **位置：** `apps/api/src/download-executor.ts:50`
- **发现时间：** 2026-07-07
- **问题：** yt-dlp 未输出速率或格式异常时返回 0 → UI 显示 `0 B/s` → 用户误判下载停滞（但 progress 百分比可能仍在增长）
- **影响：** 用户体验混乱，"0 B/s" 可能表示"解析失败"或"真实静止"
- **建议方案：** 将 `parseDataRateText` 返回类型改为 `number | null`，`null` 表示解析失败；UI 显示 "—" 或 "计算中"
- **估算工作量：** 5-8 行类型调整 + UI 条件渲染 + 测试用例

---

### 🟡 P1 — 性能与可维护性（5 项）

#### TD-006: buildMetrics 串行执行独立异步操作
- **位置：** `apps/api/src/routes/system.ts:59`
- **发现时间：** 2026-07-07
- **问题：** `memorySnapshot()` 和 `sampleGpu()` 串行等待 → 总延迟为两者之和（最坏 ~1s+）
- **影响：** API 响应时间增加 30-50%，影响仪表盘刷新体验
- **建议方案：** 改为 `const [memory, gpu] = await Promise.all([memorySnapshot(), sampleGpu()])`
- **估算工作量：** 1 行重构

#### TD-007: sampleProjectNetworkRates 两次遍历同一数组
- **位置：** `apps/api/src/system-sampler.ts:164`
- **发现时间：** 2026-07-07
- **问题：** 对 `browserRequests` 先求 `response_bytes` 再求 `request_bytes`，可合并为单次 reduce
- **影响：** 每次网络采样（1-2 Hz）浪费一半迭代成本，高频请求场景下累积性能损耗
- **建议方案：** 单次 reduce 同时累加两个字段
- **估算工作量：** 5 行重构

#### TD-008: formatBytesPerSecond 缺少 GB/s 支持
- **位置：** `apps/api/src/system-sampler.ts:191`
- **发现时间：** 2026-07-07
- **问题：** 2 GB/s 显示为 `2048 MB/s`，10 Gbps+ 网络或本地高速传输时显示不友好
- **影响：** 用户体验不佳，数值难以快速识别
- **建议方案：** 新增 `>= 1GB` 分支，显示 `X.X GB/s`
- **估算工作量：** 3 行代码 + 1 个测试用例

#### TD-009: task.state 对象频繁展开
- **位置：** `apps/api/src/download-executor.ts:51`
- **发现时间：** 2026-07-07
- **问题：** 每个 yt-dlp 进度事件（~1-2 Hz）都展开重建 `task.state`，长下载中累积数百次小对象分配
- **影响：** 产生不必要 GC 压力，10+ 并发下载时可能影响事件循环
- **建议方案：** 仅在 `speedBps` 变化时更新，或直接赋值 `task.state.download_bytes_per_sec` 而非重建对象
- **估算工作量：** 5 行优化

#### TD-010: formatBytesPerSecond 与 formatSpeed 重复实现
- **位置：** `apps/api/src/system-sampler.ts:188` + `apps/web/src/mockApi/shared.ts:16`
- **发现时间：** 2026-07-07
- **问题：** API 和 Web 两处格式化逻辑重复且舍入策略不一致（一个用 `/ 102.4 / 10`，一个用 `toFixed(1)`）
- **影响：** 需同步修改两处，容易遗漏导致前后端展示不一致
- **建议方案：** 提取为 `packages/shared/utils/formatBytesPerSecond.ts` 统一实现
- **估算工作量：** 10 行重构 + 路径调整

---

### 🟢 P2 — 设计层次问题（1 项）

#### TD-011: cpuPrevious 模块级全局状态
- **位置：** `apps/api/src/system-sampler.ts:30`
- **发现时间：** 2026-07-07
- **问题：** `sampleCpuPercent()` 依赖模块级可变状态，测试需手动调用 `resetCpuSamplerForTests()` 重置
- **影响：** 测试隔离成本，未来多实例采样或多租户场景扩展性受限
- **建议方案：** 重构为类或闭包封装状态，或使用 Context 模式将状态传入
- **估算工作量：** 20-30 行重构 + 测试调整
- **备注：** 当前单进程部署下影响有限，可推迟至多实例需求明确时处理

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
- **问题：** 多标签页 UI 前端已接入，但标签切换隐藏旧 view、view 生命周期与多标签下载体验仍待桌面端真机验收；网络事件目前按窗口聚合而非按标签隔离
- **影响：** 多标签场景下载归属、权限提示和错误处理可能混乱
- **建议方案：** 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），并调整网络事件路由按 `viewId` 隔离
- **估算工作量：** 主要是测试验收 + 事件路由调整 5-10 行

#### TD-014: Electron 生产打包工具链
- **位置：** `apps/desktop/` + `apps/api/`
- **来源：** CONTEXT.md 剩余黄灯
- **问题：** `apps/web` 构建已加 `base: './'` 支持 `file://` 加载，但 Electron 打包工具链（electron-builder/forge）、preload 生产路径和本地 API 生产运行时（当前依赖 `tsx` + 源码）仍待验收
- **影响：** 无法打包生产版本，当前只能开发模式运行
- **建议方案：** 
  1. 引入 electron-builder 或 electron-forge 配置
  2. 配置 preload 脚本的生产构建路径
  3. 将本地 API 从 `tsx` + 源码改为打包后的 JS 运行时
- **估算工作量：** 20-40 行配置 + 路径调整 + 打包验证

#### TD-015: PSD 真实 Photoshop 联调
- **位置：** `packages/psd-core/` + `workers/psd-worker/`
- **来源：** CONTEXT.md 剩余黄灯
- **问题：** PSD Photoshop adapter 已建立脚本命令边界；PSD 工作台已接入模板检查、manifest 编辑、批量渲染（仅文字 slot）和 manifest JSON sidecar 持久化；渲染输出路径已收口在工作区内；但真实 Photoshop 本机命令路径、复杂 batchPlay 和 image/smart-object slot 渲染尚未联调
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
- **问题：** GPU 指标已接入 Windows/Linux NVIDIA 与 Windows 性能计数器回退，但 macOS GPU 仍待补齐
- **影响：** macOS 用户无法查看 GPU 利用率
- **建议方案：** 
  1. 调研 macOS GPU 采集方式（`ioreg`、`powermetrics` 或 Metal API）
  2. 实现 `readMacOsGpuUtilization()` 函数
  3. 在 `readGpuUtilization()` 中添加 macOS 分支
- **估算工作量：** 15-30 行实现 + macOS 真机验证

---

## 已偿还债务（归档）

_偿还完成的债务移至此处，保留修复时间和 commit hash 供后续审计_

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
