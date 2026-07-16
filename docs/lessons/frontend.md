# 前端、契约与迁移经验

- T-005：前后端可见枚举（如 app id、PSD slot 类型）以 `packages/contracts` 为准，避免 registry、API 和 worker 漂移。
- T-006：暂不支持的 PSD slot 必须显式拒绝，不能静默忽略 image / smart-object 这类用户以为已生效的输入。
- T-007：API/Web 共享格式化逻辑放到共享包；不要让 `formatSpeed`、`formatBytesPerSecond` 这类显示规则双写分叉。
- T-011：通用 HTTP 封装只为明确的 JSON 字符串 body 自动设置 `application/json`；`FormData`、`Blob` 与 `ArrayBuffer` 必须由浏览器或调用方决定 `Content-Type`，multipart boundary 不得手写。
- M-001：Legacy 只提供布局、密度、资产和用户路径参考；旧 API 耦合、vendor、缓存、构建产物不得回流。
- M-002：新增 UI 优先接 `packages/contracts` 与真实 API 契约；mock 只能作为测试夹具或迁移参考，并明确标注。
- M-003：第三方能力必须走 adapter，命令参数构建、进程执行、进度解析、错误归一分层处理。
- M-004：仅桌面端可用的能力在纯 Web 模式必须明确说明边界，并提供当前 Web 桌面中可完成的替代路径；不能只留“未连接”提示。
