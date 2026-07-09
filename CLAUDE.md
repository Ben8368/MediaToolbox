# MediaToolbox — Claude Code 入口

> 自动加载摘要。完整规则与冲突裁决以 `AGENTS.md` 为准。

## 开局

1. 每轮必读：[CONTEXT.md](CONTEXT.md)、[LESSONS.md](LESSONS.md)。
2. 代码改动按需读：[docs/AI_RULES.md](docs/AI_RULES.md)、[docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)、[docs/UI_COMPAT.md](docs/UI_COMPAT.md)。
3. 高风险或规划 / 发布任务按需回到 [AGENTS.md](AGENTS.md) 的四层读取结构。

## 只记三件事

- 代码改动后的审查、验证、提交与推送处理均以 [docs/AI_RULES.md](docs/AI_RULES.md) 为准。
- 本仓库是 TypeScript monorepo；UI 经本地 API、worker 和 adapter 使用生产能力。
- 不确定时回到 [AGENTS.md](AGENTS.md)，不要在本摘要里新增规则。
