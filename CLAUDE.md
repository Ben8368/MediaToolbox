# MediaToolbox — Claude Code 入口

> 自动加载摘要。完整规则与冲突裁决以 `AGENTS.md` 为准。

## 开局

1. 读 `CONTEXT.md`，确认当前阶段、阻断项、黄灯和下一步。
2. 按任务关键词查 `LESSONS.md`。
3. 按需读取专题文档：
   - 编码与审查：`docs/AI_RULES.md`
   - API 边界：`docs/FRONTEND_API_CONTRACT.md`
   - UI 兼容：`docs/UI_COMPAT.md`
   - 阶段路线：`docs/ROADMAP.md`

## 只记三件事

- 代码改动后按 `docs/AI_RULES.md` 输出 `🚦 Audit Report`，再跑 `npm run verify`；🟢 且验证通过时自动 commit 并 push（细则见 `docs/AI_RULES.md`）。
- 本仓库是 TypeScript monorepo；UI 经本地 API、worker 和 adapter 使用生产能力。
- 不确定时回到 `AGENTS.md`，不要在本摘要里新增规则。
