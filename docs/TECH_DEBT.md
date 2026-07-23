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

### 🟡 P1 — 从 CONTEXT.md 黄灯与代码审查迁移（7 项）

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
- **来源：** Phase 5.5 beta 验收待办
- **目标阶段：** Web Composer 候选版本前
- **阻断候选构建：** 是，若候选版本承诺离线或 4K/15 秒稳定导出
- **验证方式：** 三套预设分别覆盖默认素材、工作区图片、工作区视频，在 16:9/4:3/1:1/9:16 下完成 PNG 与 MP4；4K 明确定义为 UHD `3840×2160`（不是 DCI `4096×2160`），重点记录 15 秒导出耗时、峰值内存、文件体积和失败提示
- **问题：** 基础 PNG 和 1 秒 1080p H.264 MP4 已通过；视频加载失败会明确终止导出，录制成功或异常路径均会释放 recorder、stream track、媒体监听器与 timer；默认视频已迁移到固定 SHA-256 的版本化 Release Asset，但 4K/长时捕获基线仍待完成
- **影响：** 高规格视频导出可能较慢或触发捕获超时
- **建议方案：** 为高规格捕获建立分级预设、耗时提示和压力测试基线
- **估算工作量：** 资产治理与桌面压力验收为主

#### TD-013: 浏览器多标签页桌面端真机验收
- **位置：** `apps/desktop/src/browserViews.ts` + `apps/web/src/apps/browser/`
- **来源：** Phase 4.5 桌面端验收待办
- **目标阶段：** Phase 4.5 桌面端验收
- **阻断候选构建：** 是，若 view 生命周期或下载归属在真机失败
- **验证方式：** 桌面端真机覆盖新建/切换/关闭标签、后台下载归属、权限提示和取消下载隔离
- **问题：** 多标签页 UI 前端已接入，下载、权限和上传侧栏事件已按活动 `viewId` 展示，下载取消也校验 `viewId` 归属；但标签切换隐藏旧 view、view 生命周期与多标签下载体验仍待桌面端真机验收。
- **影响：** 桌面端真机多标签场景仍可能暴露 view 隐藏、销毁或焦点生命周期问题
- **建议方案：** 桌面端真机验收多标签页 UI（新建/切换/关闭/生命周期/隐藏旧 view），重点覆盖后台标签下载归属、权限提示和取消下载隔离。
- **估算工作量：** 主要是测试验收

#### TD-015: PSD 真实 Photoshop 联调
- **位置：** `packages/psd-core/` + `workers/psd-worker/` + `fixtures/psd/photoshop-workbench/`
- **来源：** Phase 5 Photoshop 联调待办
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


#### TD-028: Job 可重试调度与幂等输出
- **位置：** `apps/api/src/job-recovery.ts` + `apps/api/src/*-executor.ts` + `packages/job-core/`
- **来源：** 全仓技术债复核（2026-07-15）
- **目标阶段：** 长任务可靠性迭代
- **阻断候选构建：** 否；若承诺进程重启后自动续跑则是
- **已完成：** 所有服务端 Job ID 已统一为带业务前缀的 UUID；API 启动会将 SQLite 遗留的 `queued` / `running` / `paused` 孤儿任务原子标记为 `failed`，写入明确中断原因和审计日志，并吊销绑定 PathGrant。下载、转码、PSD 与 Web Composer executor 已由实例级 registry 跟踪；Fastify 关闭会取消排队下载、终止活动任务、等待 executor 清理完成后再关闭数据库，下载取消会终止 yt-dlp 及其子进程树。
- **剩余问题：** 当前仍不自动重试，也没有 attempt/checkpoint/幂等输出 token；进程重启后的任务只能明确失败，不能安全续跑。
- **影响：** API 重启与关闭不再留下永久运行中的假任务，也不会让 executor 与关库竞争，但暂时性失败仍需用户手动重提。
- **建议方案：** 设计 `attempt`、`maxAttempts`、`nextAttemptAt`、错误分类、指数退避和幂等 Asset 提交；不得恢复没有调度语义的 `retrying` 伪状态。
- **估算工作量：** 中等，需要数据库契约、调度器、executor 和重启/关闭集成测试协同修改。

#### TD-030: 可见性轮询生命周期竞态
- **位置：** `apps/web/src/hooks/useVisibilityPolling.ts`
- **来源：** 全仓代码审查（2026-07-23）
- **目标阶段：** 前端运行时可靠性迭代
- **阻断候选构建：** 否
- **问题：** effect 在页面初始隐藏时仍立即请求并启动 interval；禁用、卸载或重建 effect 不会隔离已在途回调，旧请求可能在新一代轮询启动后写回状态，且新一代首次刷新可能被共享的 `inFlightRef` 跳过
- **影响：** 通知、日志、系统指标、下载和转码状态在后台恢复或系统生命周期切换后可能短暂陈旧，并可能发生卸载后状态写回
- **建议方案：** 为每代 effect 增加 active/generation 标记，只在页面可见时启动；回调支持 `AbortSignal` 或至少忽略失效代结果，并覆盖 hidden mount、disable/re-enable、unmount in-flight 三类测试
- **估算工作量：** 小到中等，需同步检查 6 个调用方的错误与 loading 状态语义
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

## 已偿还债务

已偿债按月份归档到 [docs/archive/tech-debt/](archive/tech-debt/2026-07.md)，避免干扰活跃债务的读取和维护。

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
4. **归档 → 审计：** 移至 `docs/archive/tech-debt/`，记录修复时间和 commit，供后续复盘

## 与现有体系的衔接

- **红绿灯审查：** 🔴 阻断项中的系统性问题可转为 P0 技术债，🟡 优化项中需跨任务跟进的内容可转为 P1/P2
- **[CONTEXT.md](../CONTEXT.md)：** P0 债务若影响阶段推进，应在「当前决策」中以 ID 和一句摘要标记
- **[LESSONS.md](../LESSONS.md)：** 债务偿还过程中的可复发经验应补充到匹配的详情文件
