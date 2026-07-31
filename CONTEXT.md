# 当前状态

> **最后确认：** 2026-07-31<br>
> **阶段：** Phase 4.5 / 5 已接入，Phase 5.5 Web Composer beta 已接入（现有 8 个预设、透明 PNG 与 Alpha MOV 导出），Phase 6A/B/C PathGrant 管道已落地。详细能力边界见 [ROADMAP.md](docs/ROADMAP.md)。

## 当前决策

- 内部开发没有代码级阻断；**TD-028** 已补齐下载/转码进程内受控自动重试、持久 attempt 与幂等输出 token，进程重启续跑仍保留为后续债务；Electron Builder 已升级到稳定补丁 `26.15.6`，其构建期上游例外仍按 **TD-033** 跟踪。公开发布仍被 **TD-023** 阻断：缺少根 `LICENSE`，且 `assets/web-composer/PROVENANCE.json` 尚未逐项覆盖 8 个基础 MP4 与 3 个补充 MP4，详见 [TECH_DEBT.md](docs/TECH_DEBT.md)。
- **TD-019** 的实现与自动化烟测已接入，尚待首次 tag Release 在 Windows、macOS、Linux 实跑；这不是“renderer 不可用”的代码阻断。
- 最近客观验证：2026-07-31 `npm run verify` 通过（50 个测试文件、288 项），常规 release preflight 通过并保留签名/公证警告；本机 Windows 打包因缺少 Visual Studio C++ Build Tools 无法重建 `better-sqlite3`，未生成安装包。此前 macOS arm64 Electron 目录包的包内 API、根 renderer、图标和代表性视频 loopback 检查通过。公开 preflight 仍按设计拒绝缺失的授权证据。

## 近期优先级

1. 补齐项目许可证与默认视频逐项授权证据，运行公开发布 preflight（TD-023）。
2. 收口候选版本验收：三平台 Release（TD-019）、Browser Network / 多标签（TD-013）、PSD Photoshop（TD-015）、Web Composer 4K/15 秒（TD-021）及 PathGrant 桌面体验（TD-032）。
3. 跟踪 Electron Builder 稳定版依赖升级并清理构建期 advisory 例外（TD-033）。

## 按需入口

- 技术债与验收细节：[docs/TECH_DEBT.md](docs/TECH_DEBT.md)、[docs/API_VALIDATION.md](docs/API_VALIDATION.md)
- 能力阶段与后续规划：[docs/ROADMAP.md](docs/ROADMAP.md)
- 架构与 API 边界：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/FRONTEND_API_CONTRACT.md](docs/FRONTEND_API_CONTRACT.md)
- 历史状态记录：[docs/archive/status/2026-07-15.md](docs/archive/status/2026-07-15.md)
