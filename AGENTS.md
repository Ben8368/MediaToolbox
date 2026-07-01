# AI 协作规范

`AGENTS.md` 是 Codex / 通用 AI 的治理入口和权威规则源。工具专属入口只做摘要：`CLAUDE.md` 给 Claude Code，`.cursorrules` 给 Cursor。

## 开局读取

每轮先读最小上下文：

1. `CONTEXT.md`：当前阶段、阻断项、黄灯、下一步。
2. `LESSONS.md`：按任务关键词匹配压缩错题。
3. 按需扩展：
   - 编码与审查：`docs/AI_RULES.md`
   - API 边界：`docs/FRONTEND_API_CONTRACT.md`
   - UI 兼容：`docs/UI_COMPAT.md`
   - 阶段路线：`docs/ROADMAP.md`
   - 长历史：`docs/archive/`

原则：入口文件保持短小；细节、历史和长复盘下沉到 `docs/`。

## 工作流

- 先确认 `CONTEXT.md` 的当前快照，再动手。
- 代码改动后按 `docs/AI_RULES.md` 输出 `🚦 Audit Report`，再跑客观验证。
- 客观验证由 AI 执行；用户只负责主观体验和业务判断。
- 前端客观验证默认：`npm --prefix frontend run verify`。
- 后端改动至少执行：`npm --prefix backend run typecheck`。
- 阶段、功能、用户命令、API 契约或架构边界变化时，同步更新 `CONTEXT.md`、README 或相关 `docs/`。

## 架构边界

- 本仓库是 [Ben8368/MediaTools-v2](https://github.com/Ben8368/MediaTools-v2) 的前端提取移植阶段，不是旧项目整体搬迁。
- 前端负责交互、展示、任务提交和状态呈现；媒体处理、文件系统、外部工具调用属于服务层。
- 正式开发默认经 `@/api` / `realApi` 接真实 HTTP API。
- `mockApi/` 只作为历史迁移参考或测试夹具，不作为生产或正式开发路径。
- 不得把未接入的下载、文件浏览、日志、系统指标等 mock 能力写成生产事实。
- Legacy 只提供布局、资产、视觉节奏和用户路径参考；旧 API 耦合、vendor、缓存、构建产物不得回流。

## 前端体验

- 首屏必须是可使用的 NAS 风格 Web 桌面，不做营销页或说明页。
- 保持左侧状态栏、桌面区、窗口层、启动器、右侧状态面板的空间关系。
- 应用入口统一走 `frontend/src/appRegistry.tsx`。
- 样式按现有 `frontend/src/styles/` 分区组织。
- 用户可见错误、空态、加载态必须可读。
- 文本不能在按钮、表格、窗口标题或窄屏布局中溢出。

## TypeScript / React

- 使用函数组件和 hooks。
- 公共类型优先放在使用边界附近；跨模块共享类型再拆到 `types.ts`。
- 避免用 `any` 逃避建模；处理未知数据时先做窄化。
- 组件不实现媒体处理、文件系统或外部工具逻辑。

## 规模与依赖

- 单个源码文件超过 350 行：审查中说明是否仍单一职责。
- 超过 450 行：继续追加逻辑前评估拆分方案。
- 超过 500 行：默认视为维护风险，除低复杂度映射或静态数据外先拆分再扩展。
- 新增运行时依赖前确认：现有能力是否足够、跨平台/浏览器兼容性、许可证、未来桌面化或真实 API 接入成本。

## 提交与署名

- 用户要求提交时再执行 `git commit`。
- commit message 的标题与正文统一使用中文；Conventional Commit 类型前缀和 Git trailer 键名保留英文规范。
- AI 工具参与实质改动且工具未自动记录来源时，在 commit message 末尾追加对应 Git trailer，前方保留一个空行。
- 已确认 trailer：
  - Claude Code：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  - Cursor：`Co-authored-by: Cursor <cursor@cursor.sh>`
  - Codex：`Co-authored-by: Codex <codex@openai.com>`
- 只做建议、解释或审查但未产出可提交改动的工具不署名；不虚构未确认身份。
