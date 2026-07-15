# AI 协作规范

`AGENTS.md` 是通用 AI 的唯一入口；`CLAUDE.md` 与 `.cursorrules` 只能保留摘要。规则细节只在其权威文档中维护，不在入口重复。

## 开局与按需读取

所有任务先读 [CONTEXT.md](CONTEXT.md)（状态卡）和 [LESSONS.md](LESSONS.md)（错题路由），再仅加载下表命中的文档；不要为“可能相关”预读长文档。

| 任务 | 必读文档 |
| --- | --- |
| 任意源码改动 | [docs/AI_RULES.md](docs/AI_RULES.md)、[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 前端或 API 边界 | [docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)；前端另读 [docs/UI_COMPAT.md](docs/UI_COMPAT.md) |
| worker、外部工具、路径或权限 | [SECURITY.md](SECURITY.md)；契约变化另读 API Contract 与相关 ADR |
| 下载策略 | [docs/YTDLP_CAPABILITY.md](docs/YTDLP_CAPABILITY.md) |
| 验收、发布或素材包 | [docs/API_VALIDATION.md](docs/API_VALIDATION.md)、[docs/RELEASE.md](docs/RELEASE.md)；素材包另读 `assets/web-composer/README.md` |
| 技术债、阶段或规划 | [docs/TECH_DEBT.md](docs/TECH_DEBT.md)、[docs/ROADMAP.md](docs/ROADMAP.md) |
| 治理文档改动 | [docs/GOVERNANCE.md](docs/GOVERNANCE.md) |
| 维护职责或架构决策 | [docs/MAINTAINERS.md](docs/MAINTAINERS.md)、[docs/ADR/README.md](docs/ADR/README.md) |

Windows PowerShell 读取中文或输出中文前，初始化 UTF-8，并对 `Get-Content` 显式使用 `-Encoding UTF8`；具体命令见 `scripts/dev/init-utf8-console.ps1`。

## 不可跨越的边界

- 本仓库是 TypeScript monorepo：Web 负责交互，本地 API 负责编排与安全，worker 负责长任务，共享契约与 adapter 位于 `packages/*`。
- UI 不直接调用 `yt-dlp`、`ffmpeg`、Photoshop、危险文件操作或系统命令；第三方能力必须经 adapter 分层。
- Legacy 仅作布局、资产和用户路径参考；旧 API 耦合、vendor、缓存和构建产物不得回流。
- 前端保持 NAS 风格 Web 桌面的可用首屏；错误、空态、加载态可读，窄屏文本不溢出。其余实现细则以 Architecture / UI Compat 为准。

## 执行与汇报

- 源码改动后按 `AI_RULES` 输出 `🚦 Audit Report`，再执行客观验证（默认 `npm run verify`）；客观项由 AI 验证，主观体验须保留给用户确认。
- 只更新发生事实变化的权威文档：状态进 [CONTEXT.md](CONTEXT.md)，技术债进 `TECH_DEBT`，规划进 `ROADMAP`，契约进 API Contract，长期决策进 ADR。不要在多处复制。
- 绿灯提交、推送、提交信息与 Git trailer 全部以 `AI_RULES` 为准。
- 默认用中文汇报；代码标识、命令、路径、API 字段、日志与专有名词保留原文。

## 治理文档自治理

- 改动治理文档时遵守 [docs/GOVERNANCE.md](docs/GOVERNANCE.md) 的单一事实源、篇幅预算和归档规则，并运行 `npm run docs:governance:check`。
- `AGENTS.md`、`CONTEXT.md`、`LESSONS.md` 是强制加载面：只保留路由、当前决策和索引；历史、命令手册和长复盘进入权威文档或 `docs/archive/`。
