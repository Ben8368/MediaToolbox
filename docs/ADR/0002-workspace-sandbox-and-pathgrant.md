# ADR 0002: 工作区沙箱与 PathGrant

- 状态：已接受
- 日期：2026-07-07

## 背景

MediaToolbox 需要处理本地文件、转码输入、PSD 模板和导出路径。直接开放磁盘路径会带来任意文件读取、任意文件写入、误删和隐私泄露风险；但只允许 `/Workspace` 又会限制用户导入外部素材。

## 决策

- 默认文件能力继续使用虚拟 `/Workspace`，由 API 映射到受控本地目录。
- 裸盘符、UNC、`..` 和工作区外路径默认拒绝。
- 工作区外访问必须通过 PathGrant。
- 读授权和写授权分离；写入工作区外必须二次确认。
- 前端和任务 payload 只传 `grantId`，不持有、不拼接工作区外物理路径。
- API 负责签发、校验和吊销 grant，并记录审计日志。
- worker 只消费任务附带的 grant，不自行扩大搜索范围。
- Job 自动重试的 `running → queued` 不是终态，绑定 grant 在 attempt 间保留；最终成功、失败或取消时再吊销。

## 后果

好处：

- 保持默认沙箱简单可靠。
- 支持外部文件导入和外部导出，同时保留用户确认与审计。
- 避免把裸路径扩散到前端和 worker。

代价：

- 任务契约需要支持 `inputGrantId` 和 `outputGrantId`。
- 纯 Web 模式需要明确降级。
- grant 生命周期、TTL 和 job 绑定需要持续验证。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_API_CONTRACT.md`
- `docs/API_VALIDATION.md`
- `docs/ROADMAP.md`
