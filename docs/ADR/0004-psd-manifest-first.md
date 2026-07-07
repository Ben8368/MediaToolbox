# ADR 0004: PSD manifest 优先模型

- 状态：已接受
- 日期：2026-07-07

## 背景

PSD 自动化需要在模板检查、slot 编辑、批量渲染和 Photoshop 联调之间保持稳定契约。若前端直接依赖 Photoshop 脚本细节，会导致 UI、API 和 worker 强耦合。

## 决策

- PSD 工作台以 template manifest 为中心。
- manifest、slot 和 render input 类型收敛到 `packages/contracts`。
- 前端编辑 manifest 和提交渲染意图；不直接调用 Photoshop。
- API 和 worker 负责校验路径、slot 类型、输出位置和执行边界。
- 当前仅支持 text slot；非文字 slot 输入明确拒绝，避免静默忽略。
- manifest sidecar 与 PSD 同目录持久化，用于保存/加载往返。

## 后果

好处：

- 前端、API、worker 和 Photoshop adapter 之间有稳定契约。
- 非文字 slot 未实现时不会被误报成功。
- 后续 image / smart-object slot 可以在同一 manifest 模型下扩展。

代价：

- 复杂 PSD 和 batchPlay 仍需真机联调。
- sidecar 与 PSD 文件生命周期需要继续打磨。
- manifest schema 演进需要兼容旧模板。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/API_VALIDATION.md`
- `docs/TECH_DEBT.md`

