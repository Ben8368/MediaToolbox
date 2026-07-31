# ADR 0007: Job attempt 与受控自动重试语义

- 状态：已接受
- 日期：2026-07-31

## 背景

长任务原先只有 `queued/running/failed` 等生命周期状态。暂时性网络或外部工具错误会立即失败，且任务没有执行次数、下次执行时间或跨 attempt 稳定的输出标识。直接增加一个 `retrying` 展示状态无法解决调度、取消、PathGrant 生命周期和重复产物问题。

## 决策

- `JobRecord` 持久化 `attempt`、`maxAttempts`、`nextAttemptAt` 与 `outputToken`。
- 重试等待继续使用 `queued`，并以 `nextAttemptAt` 表达最早调度时间；不增加没有调度语义的 `retrying` 状态。
- 只有 adapter 明确归一化为 `retryable: true` 的错误允许自动重试。下载与转码当前最多执行 3 次，采用 1、2 秒指数退避；参数、权限、缺工具和已知不可恢复错误立即失败。
- `outputToken` 在同一 Job 的所有 attempt 间保持稳定。转码 attempt 写入 token 隔离的临时文件，成功后原子替换最终输出，并以 Job ID 幂等提交 Asset。
- `running → queued` 的重试转换不是终态，不吊销绑定 PathGrant；成功、最终失败或取消后才统一回收。
- SQLite 私有 `job_executions` 表按 executor 版本保存下载与转码执行载荷，并与 Job 原子创建；该载荷不属于共享 `JobRecord`，不得通过 Web API 暴露物理路径。
- API 异常重启时，只恢复执行载荷完整、当前路径授权仍匹配且剩余 attempt 未耗尽的下载/转码任务。中断的 `running` 消耗一次 attempt 后回到 `queued`；载荷缺失/损坏、授权不匹配、次数耗尽、暂停任务或未开放恢复的 Job 明确失败。
- 恢复采用安全的整次 attempt 重跑，不承诺字节级 checkpoint。转码开始新 attempt 前恢复被中断的 `.backup`，删除不完整 `.partial`，再沿用稳定 `outputToken` 完成幂等提交。

## 后果

好处：

- 暂时性下载网络错误和转码未知工具错误可以自动恢复。
- API 异常退出后，下载与转码可在不扩大 Web API 或路径权限面的前提下自动续跑。
- 前端和日志能够区分执行次数、退避等待与最终失败。
- 重试不会提前回收授权，也不会直接覆盖既有转码输出。

代价：

- Job schema 增加迁移、调度元数据和 API 私有执行载荷表。
- 进程内退避期间 executor 仍持有一个执行槽。
- 下载与转码在重启后从新 attempt 开始，不提供媒体字节级断点续传。
- PSD、Web Composer 仍需分别证明幂等载荷和 Asset 提交后才能启用自动重试或重启恢复。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_API_CONTRACT.md`
- `docs/API_VALIDATION.md`
- `docs/TECH_DEBT.md`（TD-028）
- `docs/ADR/0002-workspace-sandbox-and-pathgrant.md`
