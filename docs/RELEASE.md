# 发布流程

本文定义发布前的工程检查。当前项目尚未进入稳定公开发布阶段；Electron 生产打包基础链路已打通，发布流程仍以候选构建、真实路径验收、签名/公证准备和完整安装包验收为主。

## 版本策略

- 进入公开发布前使用 `0.x.y`。
- `x` 表示阶段能力推进，例如桌面壳、PathGrant、PSD 工作台。
- `y` 表示修复、文档、验收或小功能。
- 破坏性契约变化必须在 PR 和变更记录中明确说明。

## 发布前检查

1. 确认 [CONTEXT.md](../CONTEXT.md) 的当前阶段、阻断项、黄灯和下一步真实。
2. 确认 [ROADMAP.md](ROADMAP.md) 与当前状态一致。
3. 运行 `npm run verify`。
4. 运行 `npm run release:preflight`，确认 Electron runtime bundle、renderer 资源、图标来源和发布签名/公证环境提示。
5. 对涉及桌面壳、浏览器 session、PathGrant、下载、转码或 Photoshop 的改动执行对应真实路径验收。
6. 检查仓库不包含 `.env`、凭据、客户素材、缓存、日志或构建产物。
7. 如涉及安全边界变化，更新 [SECURITY.md](../SECURITY.md) 或新增 [ADR](ADR/README.md)。

## 候选构建

当前候选构建阶段：

- 不把开发模式启动等同于发布构建。
- 不把 `apps/web` 构建通过等同于桌面端可发布。
- 不把 electron-builder 目录包通过等同于完整安装包可分发。
- 桌面端候选构建必须记录操作系统、Node.js 版本、Electron 版本、本地 API 启动方式和已验收路径。

当前 Electron 发布预检覆盖：

- `apps/web/dist` 是否打入 `renderer` 资源目录。
- `apps/api/dist/server.cjs` 是否打入 `api` 资源目录。
- 桌面主进程构建、preload 文件和共享 app 图标来源是否存在。
- macOS / Windows / Linux 目标和 artifact 命名是否已配置。
- `CSC_LINK` / `CSC_NAME`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 等签名与公证环境变量是否已准备；缺失时为警告，设置 `MEDIATOOLBOX_RELEASE_STRICT=1` 或传入 `--strict` 可将警告视为失败。

## 变更记录

发布说明至少包含：

- 新增能力。
- 修复问题。
- 安全或权限边界变化。
- 已知黄灯和未完成验收。
- 回滚方式或禁用方式。

## 回滚原则

- API 契约、数据库 schema、PathGrant、文件写入和任务状态机相关变更必须提供回滚判断。
- 不能安全回滚时，发布说明中必须标记为单向迁移。
- 出现任意文件读写、命令注入、session 泄露或数据损坏风险时，优先撤回发布并修复。
