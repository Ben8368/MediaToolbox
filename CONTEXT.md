# 当前状态

> **最后确认：** 2026-07-25<br>
> **阶段：** Phase 4.5 / 5 已接入，Phase 5.5 Web Composer beta 已接入（现有 7 个预设、透明 PNG 与 Alpha MOV 导出），Phase 6A/B/C PathGrant 管道已落地。详细能力边界见 [ROADMAP.md](docs/ROADMAP.md)。

## 当前决策

- 内部开发没有代码级阻断；**TD-031** 依赖告警已完成在线分级与兼容修复，React Router 剩余告警不适用于当前 `BrowserRouter` 模式，Electron Builder 稳定版的构建期上游例外转为 **TD-033**。公开发布仍被 **TD-023** 阻断：缺少根 `LICENSE`，且 `assets/web-composer/PROVENANCE.json` 尚未逐项覆盖 8 个基础 MP4 与 2 个补充 MP4，详见 [TECH_DEBT.md](docs/TECH_DEBT.md)。
- **TD-019** 的实现与自动化烟测已接入，尚待首次 tag Release 在 Windows、macOS、Linux 实跑；这不是“renderer 不可用”的代码阻断。
- 最近客观验证：2026-07-25 `npm run verify` 通过（47 个测试文件、277 项）；依赖兼容补丁后的 macOS arm64 Electron 目录包构建、包内 API、根 renderer、图标和代表性视频 loopback 检查通过。`npm run release:preflight:public` 仍按设计拒绝缺失的公开授权证据。

## 近期优先级

1. 补齐项目许可证与默认视频逐项授权证据，运行公开发布 preflight（TD-023）。
2. 收口候选版本验收：三平台 Release（TD-019）、Browser Network / 多标签（TD-013）、PSD Photoshop（TD-015）、Web Composer 4K/15 秒（TD-021）及 PathGrant 桌面体验（TD-032）。
3. 跟踪 Electron Builder 稳定版依赖升级并清理构建期 advisory 例外（TD-033）。

## 按需入口

- 技术债与验收细节：[docs/TECH_DEBT.md](docs/TECH_DEBT.md)、[docs/API_VALIDATION.md](docs/API_VALIDATION.md)
- 能力阶段与后续规划：[docs/ROADMAP.md](docs/ROADMAP.md)
- 架构与 API 边界：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)
- 历史状态记录：[docs/archive/status/2026-07-15.md](docs/archive/status/2026-07-15.md)
