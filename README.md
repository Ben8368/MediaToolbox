# MediaToolbox

MediaToolbox 是一个 NAS 风格 Web 桌面加本地媒体工作流引擎。项目优先使用 TypeScript，采用前后端分离、模块化、任务驱动和 adapter 解耦设计。

## 当前骨架

- `apps/web`：从远端迁回的 NAS 风格 React/Vite 前端。
- `apps/api`：本地 Fastify API 服务入口。
- `apps/desktop`：Electron 桌面壳入口。
- `packages/contracts`：前后端共享契约。
- `packages/job-core`：任务状态机与任务模型。
- `packages/downloader`：下载器 adapter，优先封装 `yt-dlp`。
- `packages/ffmpeg`：`ffmpeg` / `ffprobe` 命令构建与执行边界。
- `packages/psd-core`：PSD 模版、slot 和 Photoshop 自动化边界。
- `workers/*`：下载、转码、PSD 批处理 worker。

## 常用命令

```bash
npm run dev:web
npm run dev:api
npm run typecheck
npm run verify
```

治理入口见 [AGENTS.md](AGENTS.md)，当前阶段见 [CONTEXT.md](CONTEXT.md)，架构说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 协作与治理

- AI 协作规则：[AGENTS.md](AGENTS.md)
- 贡献流程：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全政策：[SECURITY.md](SECURITY.md)
- 行为准则：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 发布流程：[docs/RELEASE.md](docs/RELEASE.md)
- 维护职责：[docs/MAINTAINERS.md](docs/MAINTAINERS.md)
- 架构决策记录：[docs/ADR/](docs/ADR/README.md)

当前暂未选择开源许可证；正式开放外部使用或分发前，应先补充 `LICENSE`。
