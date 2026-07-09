# MediaToolbox

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。项目以 TypeScript monorepo 组织桌面壳、Web 前端、本地 API、共享契约和 worker，用任务驱动与 adapter 边界承接下载、转码、PSD 模板处理、浏览器辅助和批量自动化能力。

本 README 只做项目总目录和阅读导航；AI 协作规则、当前阶段、架构细节和长期决策分别下沉到对应文档。

## 你想做什么？

- 了解项目是什么：继续读本 README 的「项目定位」和「仓库骨架」。
- 本地跑起来：看「快速开始」。
- 看当前开发到哪了：[CONTEXT.md](CONTEXT.md)。
- 看未来路线：[docs/ROADMAP.md](docs/ROADMAP.md)。
- 理解架构边界：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。
- 对接前后端 API：[docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)。
- 做真实路径验收：[docs/API_VALIDATION.md](docs/API_VALIDATION.md)。
- 让 AI 工具接手开发：[AGENTS.md](AGENTS.md)。
- 处理技术债和黄灯：[docs/TECH_DEBT.md](docs/TECH_DEBT.md)。
- 准备发布候选版本：[docs/RELEASE.md](docs/RELEASE.md)。

## 项目定位

MediaToolbox 面向本地媒体工作流：在 NAS 风格 Web 桌面里统一管理文件、下载任务、转码任务、PSD 模板处理、浏览器辅助能力和本地自动化流程。

核心边界：

- 前端负责交互、展示、任务提交和状态呈现。
- 本地 API 负责任务编排、资产访问、安全边界和系统能力适配。
- worker 负责下载、转码、PSD 批处理等长任务执行。
- 第三方工具统一经 adapter 调用，避免 UI 或业务组件直接碰系统命令。

## 快速开始

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run dev:web
npm run dev:api
npm run dev:desktop
npm run typecheck
npm run test
npm run verify
```

Windows PowerShell 读取中文文档或运行可能输出中文的命令前，建议先执行：

```powershell
. .\scripts\dev\init-utf8-console.ps1
```

## 仓库骨架

- `apps/web`：React / Vite 前端，承载 NAS 风格 Web 桌面、窗口系统和应用入口。
- `apps/api`：本地 Fastify API 服务入口。
- `apps/desktop`：Electron 桌面壳入口。
- `packages/contracts`：前后端共享契约。
- `packages/job-core`：任务模型与状态机。
- `packages/downloader`：下载器 adapter，优先封装 `yt-dlp`。
- `packages/ffmpeg`：`ffmpeg` / `ffprobe` 命令构建与执行边界。
- `packages/psd-core`：PSD 模板、slot 和 Photoshop 自动化边界。
- `workers/*`：下载、转码、PSD 批处理 worker。

## 文档地图

### 1. 项目理解

- [CONTEXT.md](CONTEXT.md)：当前阶段、阻断项、黄灯和下一步。
- [docs/ROADMAP.md](docs/ROADMAP.md)：阶段路线和未来规划。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：架构边界与模块职责。
- [docs/ADR/](docs/ADR/README.md)：长期架构决策记录。

### 2. 开发执行

- [docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)：前后端最小 API 契约。
- [docs/API_VALIDATION.md](docs/API_VALIDATION.md)：真实路径验收清单。
- [docs/UI_COMPAT.md](docs/UI_COMPAT.md)：UI 兼容与体验约束。
- [docs/YTDLP_CAPABILITY.md](docs/YTDLP_CAPABILITY.md)：`yt-dlp` 与浏览器下载路由策略。

### 3. AI 协作治理

- [AGENTS.md](AGENTS.md)：通用 AI 协作入口和权威规则源。
- [LESSONS.md](LESSONS.md)：每轮必读的压缩错题本。
- [docs/AI_RULES.md](docs/AI_RULES.md)：红绿灯审查、客观验证、提交与推送规则。
- [docs/TECH_DEBT.md](docs/TECH_DEBT.md)：黄灯、技术债和偿还计划。

### 4. 安全、发布与维护

- [SECURITY.md](SECURITY.md)：安全策略。
- [CONTRIBUTING.md](CONTRIBUTING.md)：人类贡献流程。
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)：行为准则。
- [docs/RELEASE.md](docs/RELEASE.md)：发布流程。
- [docs/MAINTAINERS.md](docs/MAINTAINERS.md)：维护职责与升级评审边界。

### 5. 历史与归档

- `docs/archive/`：长历史、复盘和不适合放进每轮上下文的材料。

## 治理闭环

```text
CONTEXT 定当前事实；
ROADMAP 定未来方向；
AI_RULES 定执行规则；
TECH_DEBT 接住黄灯；
ADR 记录长期决策；
LESSONS 压缩反复踩坑。
```

实际工作流：

```text
需求 / 开发任务
  → 读 CONTEXT + LESSONS
  → 按需读 ARCHITECTURE / CONTRACT / UI / SECURITY
  → 编码或改文档
  → AI_RULES 红绿灯审查
  → npm run verify
  → 红灯修复
  → 黄灯进入 CONTEXT 或 TECH_DEBT
  → 长期架构变化进入 ADR
  → 阶段变化更新 ROADMAP / CONTEXT
```

## 协作与许可

AI 工具接手任务时，先从 [AGENTS.md](AGENTS.md) 进入；人类贡献者从 [CONTRIBUTING.md](CONTRIBUTING.md) 进入。

当前暂未选择开源许可证；正式开放外部使用或分发前，应先补充 `LICENSE`。
