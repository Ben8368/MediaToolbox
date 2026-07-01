# 当前状态

> **初始基线：** 2026-06-30
> **当前分支：** `main`
> **当前阶段：** Phase 2 - 真实服务接入
> **最近更新：** 2026-07-01，提交信息统一使用中文，`main` 已重置为初始化单提交

## 项目定位

MediaToolbox 是 [Ben8368/MediaTools-v2](https://github.com/Ben8368/MediaTools-v2) 的前端提取移植仓库。当前目标是在不搬运旧后端复杂度的前提下，维持可运行、可验证、可继续接入真实服务的 NAS 风格 Web 桌面。

## 当前快照

- 前端：React 18 + TypeScript + Vite + Zustand；桌面壳、窗口系统、应用入口、下载器、文件管理器、设置、日志入口已具备。
- API：`frontend/src/api.ts` 默认接 `realApi`；历史 `mockApi/` 仅保留为迁移参考和测试夹具。
- 后端：Fastify v5 + TypeScript；已实现下载任务、队列、JSON 持久化、yt-dlp/ffmpeg 调用、安全边界和 CORS 收紧。
- 启动：`npm start` 同时拉起后端与前端，并注入 `VITE_API_BASE_URL`。
- 部署：Docker 多阶段镜像与 nginx `/api` 反代模板已存在。
- 治理：入口文件已压缩；commit message 标题与正文统一使用中文；阶段计划和 Feature 索引见 `docs/ROADMAP.md`。

## 当前阻断项

- 无。

## 剩余黄灯

- 下载器真实任务仍需浏览器内联调和主观体验确认。
- 真实环境错误模型、超时提示、空态和降级策略仍需收敛。
- 当前没有前端测试脚本；CI 主要覆盖 typecheck 和 build。
- 样式类名仍保留历史 `fnos-*` 前缀，仅作为实现细节，不进入文档和用户文案。

## 下一步

1. 日常启动：`npm run setup` 后执行 `npm start`，访问 `http://127.0.0.1:5173`。
2. 用真实 URL 提交下载任务，确认创建、轮询、取消、历史记录和产出文件路径。
3. 补充前端测试，优先覆盖 `api/http.ts`、`scripts/start-dev.ts` 参数分支和关键 API 适配。

## 常用文档

- 治理规则：`AGENTS.md`
- 错题索引：`LESSONS.md`
- 审查规格：`docs/AI_RULES.md`
- API 契约：`docs/FRONTEND_API_CONTRACT.md`
- UI 兼容：`docs/UI_COMPAT.md`
- 路线图：`docs/ROADMAP.md`
