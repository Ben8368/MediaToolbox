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
- 当前不持久化完整执行载荷与 checkpoint。API 重启后仍将遗留活动任务标记为失败，不能宣称断点续跑。

## 后果

好处：

- 暂时性下载网络错误和转码未知工具错误可以自动恢复。
- 前端和日志能够区分执行次数、退避等待与最终失败。
- 重试不会提前回收授权，也不会直接覆盖既有转码输出。

代价：

- Job schema 增加迁移和调度元数据。
- 进程内退避期间 executor 仍持有一个执行槽。
- PSD、Web Composer 与进程重启续跑仍需分别证明幂等载荷和 checkpoint 后才能启用自动重试。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_API_CONTRACT.md`
- `docs/API_VALIDATION.md`
- `docs/TECH_DEBT.md`（TD-028）
- `docs/ADR/0002-workspace-sandbox-and-pathgrant.md`
