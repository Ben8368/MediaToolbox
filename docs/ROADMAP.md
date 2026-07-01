# Roadmap

阶段计划和 Feature 索引放在这里，避免污染每轮必读的 `CONTEXT.md`。

## Phase 1：治理与前端基线

状态：完成。

- 建立治理文档体系：`AGENTS.md`、`CONTEXT.md`、`LESSONS.md`、`docs/`。
- 建立红绿灯审查规格：`docs/AI_RULES.md`。
- 完成 NAS 风格 Web 桌面前端基线。
- 完成 mock API 模块化与可切换适配层。
- 前端工程可独立安装、typecheck、build。
- 建立初始 Git 历史。
- 完成首轮用户主观验收。

## Phase 2：真实服务接入

状态：进行中。

已完成：

- 冻结前端最小 API 契约草案：`docs/FRONTEND_API_CONTRACT.md`。
- 默认接入真实 API：`realApi`、`setApiClient`。
- 后端下载服务端点：Fastify + yt-dlp + taskQueue + taskStore。
- 安全加固：路径越界、URL 校验、CORS 收紧、进程超时。
- 一键启动真实 API 模式：`npm start`。
- 治理入口瘦身，减少每轮上下文污染。

待完成：

- 浏览器内完成下载器真实任务联调与体验验收。
- 明确错误模型、超时提示、空态和降级策略。
- 增加前端测试，覆盖高频交互和 API 适配。

## Phase 3：能力恢复与桌面化评估

状态：待评估。

- 评估接入原项目后端、TS 服务层或 Electron/Tauri 的优先级。
- 恢复真实文件浏览、真实日志和真实系统指标。
- 评估 PSD、图片、视频工具等应用入口的 MVP 范围。

## Feature 索引

| Feature | 主题 | 状态 |
| --- | --- | --- |
| 001 | 前端工程基线 | 完成 |
| 002 | NAS 风格桌面壳 | 首轮主观验收通过 |
| 003 | 应用注册与多窗口系统 | 完成 |
| 004 | 下载器 UI | 首轮主观验收通过 |
| 005 | 文件管理器 UI | 首轮主观验收通过 |
| 006 | 设置与日志入口 | 完成 |
| 007 | 治理文档与红绿灯审查 | 完成 |
| 008 | 真实下载后端（Fastify + yt-dlp） | 完成 |
| 009 | 前端 real API 联调 | 进行中 |
| 010 | 前端测试体系 | 待评估 |
