# 贡献指南

MediaToolbox 当前以个人/小团队协作为主，但所有改动都按长期项目治理处理。本文面向人类贡献者；AI 协作工具的行为规则以 [AGENTS.md](AGENTS.md) 为权威入口，自动审查、验证和提交细则见 [docs/AI_RULES.md](docs/AI_RULES.md)。

## 开发环境

- Node.js 22 或更高版本。
- 使用 npm workspaces 管理 `apps/*`、`packages/*` 和 `workers/*`。
- 安装依赖：`npm install`。
- 常用启动：
  - `npm run dev`：同时启动 Web 前端和本地 API。
  - `npm run dev:web`：只启动前端。
  - `npm run dev:api`：只启动本地 API。
  - `npm run dev:desktop`：启动 Electron 桌面壳。

## 分支与提交

- 建议从 `main` 拉出短生命周期分支，例如 `feature/path-grant-import`、`fix/browser-download-error`。
- commit message 标题和正文使用中文；Conventional Commit 类型前缀保留英文，例如 `feat:`、`fix:`、`docs:`。
- AI 工具参与实质改动并提交时，按 [AGENTS.md](AGENTS.md) 追加对应 Git trailer。
- AI trailer 记录工具来源而非具体模型来源；历史模型级署名不回改，后续按工具级映射统一。
- 文档修补类改动进入 `main` 前按主题合并；大型功能按 `contracts/db`、`worker/core`、`api`、`web`、`test/docs` 等层次拆提交。
- `main` / `master` 属于保护分支语义：默认不自动 push；非小型文档或修复改动建议先走分支和 PR。

## 改动要求

- UI 不直接执行 `yt-dlp`、`ffmpeg`、Photoshop、文件系统危险操作或系统命令。
- 第三方工具能力必须经过 adapter；命令参数构建、进程执行、进度解析和错误归一分层处理。
- 前端正式能力默认经 `apps/web/src/api` 调用真实 API 契约；`mockApi/` 只能作为测试夹具或迁移参考。
- 用户可见的错误、空态、加载态必须可读。
- 文本不能在按钮、表格、窗口标题或窄屏布局中溢出。
- 单个源码文件超过 350 行时，审查中说明是否仍保持单一职责；超过 450 行先评估拆分；超过 500 行默认视为维护风险。

## 验证

默认客观验证命令：

```bash
npm run verify
```

提交或发起 PR 前，请记录验证命令和结果；如阶段、功能、API 契约或架构边界变化，同步更新 [CONTEXT.md](CONTEXT.md) 或相关 `docs/`。AI 自动审查与自动提交流程不在本文重复，按 [docs/AI_RULES.md](docs/AI_RULES.md) 执行。

主观体验项，例如 NAS 风格桌面密度、浏览器多标签真机体验、Photoshop 联调结果，不能只用测试或构建代替。

## PR 要求

PR 描述应包含：

- 改动目的。
- 主要文件或模块。
- 验证命令与结果。
- 是否更新治理文档、API 契约或路线图。
- 提交是否已按主题整理；大型功能是否按架构层拆分。
- 是否涉及本地文件、浏览器 session、下载、Photoshop 自动化等安全边界。

以下改动应先讨论或拆成独立 PR：

- 修改工作区路径、安全授权、权限审计或外部命令执行边界。
- 修改 `packages/contracts` 的跨模块契约。
- 引入新运行时依赖。
- Electron 打包、自动更新、发布或安装器相关变更。
- 大型 UI 重构或跨多个 app 的状态模型调整。
