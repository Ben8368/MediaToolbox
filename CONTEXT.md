# 当前状态

> **最后确认：** 2026-07-15<br>
> **阶段：** Phase 4.5 / 5 已接入，Phase 5.5 Web Composer beta 已接入，Phase 6A/B/C PathGrant 管道已落地。详细能力边界见 [ROADMAP.md](docs/ROADMAP.md)。

## 当前决策

- 内部开发没有代码级阻断；公开发布被 **TD-023** 阻断：缺少根 `LICENSE` 与 8 个默认 MP4 的逐项 `assets/web-composer/PROVENANCE.json`，详见 [TECH_DEBT.md](docs/TECH_DEBT.md)。
- **TD-019** 的实现与自动化烟测已接入，尚待首次 tag Release 在 Windows、macOS、Linux 实跑；这不是“renderer 不可用”的代码阻断。
- 最近客观验证：2026-07-15 `npm run verify` 通过（35 个测试文件、209 项）；`npm run release:preflight:public` 按设计拒绝缺失的公开授权证据。

## 近期优先级

1. 补齐项目许可证与默认视频逐项授权证据，运行公开发布 preflight（TD-023）。
2. 触发并记录三平台 tag Release 的目录包烟测与单一 publish 汇总，随后处理签名、公证和安装体验（TD-019）。
3. 收口已接入能力的真实体验验收：Browser Network / 多标签（TD-013）、PSD Photoshop 联调（TD-015）、Web Composer 4K/15 秒（TD-021）及 PathGrant 桌面体验。

## 按需入口

- 技术债与验收细节：[docs/TECH_DEBT.md](docs/TECH_DEBT.md)、[docs/API_VALIDATION.md](docs/API_VALIDATION.md)
- 能力阶段与后续规划：[docs/ROADMAP.md](docs/ROADMAP.md)
- 架构与 API 边界：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)
- 历史状态记录：[docs/archive/status/2026-07-15.md](docs/archive/status/2026-07-15.md)
