# AI 协作规范

`AGENTS.md` 是通用 AI 的治理入口和权威规则源。工具专属入口只做摘要：`CLAUDE.md` 给 Claude Code。

## 开局读取

每轮先读最小上下文：

1. `CONTEXT.md`：当前阶段、阻断项、黄灯、下一步。
2. `LESSONS.md`：按任务关键词匹配压缩错题。
3. 按需扩展：
   - 架构边界：`docs/ARCHITECTURE.md`
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
- 客观验证默认：`npm run verify`。
- 阶段、功能、用户命令、API 契约或架构边界变化时，同步更新 `CONTEXT.md` 或相关 `docs/`。

## PowerShell 编码

- Windows PowerShell 中读取中文文件或运行可能输出中文的命令前，默认先初始化 UTF-8 控制台编码。
- 可在同一 PowerShell 会话中执行 `. .\scripts\dev\init-utf8-console.ps1`，或等价设置 `chcp 65001`、`[Console]::InputEncoding`、`[Console]::OutputEncoding`、`$OutputEncoding` 与 `PYTHONIOENCODING=utf-8`。
- 只看到中文乱码时，优先按终端编码问题处理，不要反复向用户报告“再用 UTF-8 确认”。
- 显式 UTF-8 读取后仍异常，才判断可能是文件本身编码或内容损坏。

## 架构边界

- 本仓库是 TypeScript monorepo：桌面壳、Web 前端、本地 API、共享包和 worker 同仓管理。
- `apps/web` 负责交互、展示、任务提交和状态呈现；首屏必须是可使用的 NAS 风格 Web 桌面。
- `apps/api` 负责本地 HTTP API、任务编排、资产访问和安全边界。
- `workers/*` 负责下载、转码、PSD 批处理等长任务执行。
- `packages/*` 存放共享契约、状态机、adapter、数据库边界和可复用工具。
- UI 不直接调用 `yt-dlp`、`ffmpeg`、Photoshop、文件系统危险操作或系统命令。
- 第三方工具调用必须经 adapter；命令参数构建、进程执行、进度解析分层处理。
- Legacy/远端前端只提供布局、资产、视觉节奏和用户路径参考；旧 API 耦合、vendor、缓存、构建产物不得回流。

## 前端体验

- 保持左侧状态栏、桌面区、窗口层、启动器、右侧状态面板的空间关系。
- 应用入口统一走 `apps/web/src/appRegistry.tsx`。
- 样式按现有 `apps/web/src/styles/` 分区组织。
- 用户可见错误、空态、加载态必须可读。
- 文本不能在按钮、表格、窗口标题或窄屏布局中溢出。

## TypeScript / React

- 使用函数组件和 hooks。
- 公共类型优先放在使用边界附近；跨模块共享类型再拆到 `packages/contracts`。
- 避免用 `any` 逃避建模；处理未知数据时先做窄化。
- 组件不实现媒体处理、文件系统或外部工具逻辑。

## 规模与依赖

- 单个源码文件超过 350 行：审查中说明是否仍单一职责。
- 超过 450 行：继续追加逻辑前评估拆分方案。
- 超过 500 行：默认视为维护风险，除低复杂度映射或静态数据外先拆分再扩展。
- 新增运行时依赖前确认：现有能力是否足够、跨平台兼容性、许可证、打包体积和维护成本。

## 提交与署名

- 用户要求提交时再执行 `git commit`。
- commit message 的标题与正文统一使用中文；Conventional Commit 类型前缀和 Git trailer 键名保留英文规范。
- AI 工具参与实质改动且工具未自动记录来源时，在 commit message 末尾追加对应 Git trailer，前方保留一个空行。
- 已确认 trailer：
  - Claude Code：`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
  - Cursor：`Co-authored-by: Cursor <cursoragent@cursor.com>`
  - Codex：`Co-authored-by: Codex <codex@openai.com>`
