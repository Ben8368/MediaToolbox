# MediaToolbox

MediaToolbox 是以 `frontend/` 为基线的 **NAS 风格 Web 桌面**，基于 React、TypeScript、Vite 和 Zustand 构建。

**项目初始基线：** 2026-06-30（Git 历史从此刻起算）

当前包含左侧状态栏、应用启动器、桌面图标、多窗口系统、右侧状态面板、下载器、文件管理器、设置和日志等 UI。正式开发默认连接真实 HTTP API；早期纯前端 Demo 已完成体验验收，不再作为启动模式。

## 系统依赖（后端下载能力）

后端使用 **yt-dlp** 和 **ffmpeg** 作为系统工具，需提前安装并置于 `PATH`。

| 工具 | 安装方式 |
|---|---|
| **yt-dlp** | 从 [GitHub Release](https://github.com/yt-dlp/yt-dlp/releases/latest) 下载独立二进制（`yt-dlp.exe` / `yt-dlp`），**无需 Python** |
| **ffmpeg** | Windows: `winget install ffmpeg` / macOS: `brew install ffmpeg` / Linux: `apt install ffmpeg` / Docker: 在 Dockerfile 中 `apk add ffmpeg` |

验证安装：

```bash
yt-dlp --version
ffmpeg -version
```

## 本地启动

```bash
npm run setup
npm start
```

根目录 `npm start` 会调用 `scripts/start-dev.mjs`，一键启动后端和前端，并自动把前端切换到真实 API 模式。打开后访问：

```text
http://127.0.0.1:5173
```

常用参数：

```bash
npm run dev -- --port 5174
npm run dev -- --host 0.0.0.0
npm run dev -- --backend-port 8081
```

## 后端启动

```bash
npm --prefix backend install
npm run dev:backend
```

后端默认监听 `http://127.0.0.1:8080`。如果只想单独启动前端并连接已有后端：

```bash
npm run dev:real
```

环境变量（可选）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | 监听端口 |
| `WORK_DIR` | 当前目录 | 下载产物根目录 |
| `YTDLP_BIN` | `yt-dlp` | yt-dlp 二进制路径 |
| `MAX_CONCURRENT_DOWNLOADS` | `2` | 最大并发下载数 |
| `TASK_STORE_PATH` | `./data/tasks.json` | 任务持久化路径 |

## 本地验证

```bash
npm --prefix frontend run verify
```

或在仓库根目录运行：

```bash
npm run verify
```

仅类型检查：

```bash
npm --prefix frontend run typecheck
```

## API 基址（可选）

```env
VITE_API_BASE_URL=http://127.0.0.1:8080
```

端点约定见 `docs/FRONTEND_API_CONTRACT.md`。

## 容器部署（可选）

仓库提供多阶段 `Dockerfile`：Node 阶段构建静态产物，nginx 阶段托管 SPA 并反代 `/api`。

构建产物固定使用**同源 `/api`** 访问后端（`VITE_API_BASE_URL` 留空），后端地址由容器**运行时**注入，因此同一镜像可在任意环境复用，无需为每个环境重新构建。

```bash
# 构建镜像
docker build -t mediatoolbox .

# 运行：通过 BACKEND_URL 指定真实后端地址（运行时注入，非构建期）
docker run -p 8080:80 -e BACKEND_URL=http://host.docker.internal:8080 mediatoolbox
```

打开 `http://127.0.0.1:8080`。前端请求 `/api/*` 由 nginx 反代到 `BACKEND_URL`，避免 CORS，也不会把后端地址烤进 JS。

| 运行时变量 | 默认值 | 说明 |
| --- | --- | --- |
| `BACKEND_URL` | `http://127.0.0.1:8080` | nginx 反代 `/api` 的目标后端 |
| `PORT` | `80` | 容器内 nginx 监听端口 |

nginx 配置模板见 `deploy/nginx.conf.template`（含 SPA 回退、指纹资源长缓存、gzip）。

> 注意：`VITE_API_BASE_URL` 是 Vite **构建期**变量，会静态编译进产物。容器化部署不要依赖它指向后端，统一走同源 `/api` + 反代。本地直连后端联调仍可用下方方式。

## 项目结构

```text
frontend/
  src/
    App.tsx
    api.ts              # API 适配入口
    api/                # 契约、HTTP、real 骨架
    mockApi/            # 历史迁移参考 / 测试夹具，不作为启动模式
    appRegistry.tsx
    windowStore.ts
    apps/
    components/
    styles/
```

## 文档治理

- `AGENTS.md`：AI 协作规范、编码规则、验证流程
- `CONTEXT.md`：项目定位、阶段计划、当前状态、Feature 索引
- `LESSONS.md`：压缩错题集
- `docs/AI_RULES.md`：红绿灯审查系统与审查顺序
- `docs/UI_COMPAT.md`：NAS 风格桌面 UI 兼容原则
- `docs/FRONTEND_API_CONTRACT.md`：API 契约与端点表
