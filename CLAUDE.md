# MediaToolbox — Claude Code 入口

> 自动加载摘要。完整规则以 `AGENTS.md` 为准。

## 开局

1. 读 `CONTEXT.md`，确认当前阶段、阻断项、黄灯和下一步。
2. 按任务关键词查 `LESSONS.md`。
3. 按需读取：
   - 编码与审查：`docs/AI_RULES.md`
   - API 边界：`docs/FRONTEND_API_CONTRACT.md`
   - UI 兼容：`docs/UI_COMPAT.md`
   - 阶段路线：`docs/ROADMAP.md`

## 硬规则

- 入口文件保持短小；长历史和复盘进入 `docs/archive/`。
- 代码改动后按 `docs/AI_RULES.md` 输出 `🚦 Audit Report`，再跑客观验证。
- 前端验证默认：`npm --prefix frontend run verify`。
- 后端改动至少执行：`npm --prefix backend run typecheck`。
- 组件只做展示与交互；媒体处理、文件系统、外部工具调用属于服务层。
- API 调用走 `@/api`；`mockApi/` 仅作迁移参考或测试夹具。
- NAS 风格 Web 桌面的空间关系不可破坏：左侧状态栏、桌面区、多窗口、启动器、右侧状态面板。
- 旧 API 耦合、vendor、缓存、构建产物不得回流。

## 提交规范

commit message 的标题与正文统一使用中文；Conventional Commit 类型前缀和 Git trailer 键名保留英文规范。
