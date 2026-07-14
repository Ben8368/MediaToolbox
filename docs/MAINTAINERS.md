# 维护者职责

本文补足人类协作边界。具体 GitHub `CODEOWNERS` 需要明确账号后再添加；在此之前，以本文件作为领域责任说明。

## 责任域

| 领域 | 范围 | 合并前重点 |
| --- | --- | --- |
| Web 前端 | `apps/web`、样式、应用注册、窗口体验 | NAS 风格空间关系、可读错误态、窄屏和文本溢出 |
| 本地 API | `apps/api`、HTTP 契约、任务编排 | 权限校验、错误码、路径边界、与 `packages/contracts` 一致 |
| 桌面壳 | `apps/desktop`、Electron IPC、BrowserWindow、WebContentsView | session 边界、文件选择、下载事件、preload 和打包路径 |
| Workers 与 adapter | `workers/*`、`packages/downloader`、`packages/ffmpeg`、`packages/psd-core` | 命令参数构建、进程执行、进度解析、取消和错误归一 |
| 素材包与二进制供应链 | `assets/*`、外部 Release Asset、素材清单和安装工具 | 来源与再分发授权、版本/tag 不可变性、哈希、兼容性、可用性和回滚 |
| 安全边界 | PathGrant、工作区路径、浏览器权限、外部工具调用 | 最小授权、审计日志、无裸路径、无命令注入 |
| 治理文档 | [AGENTS.md](../AGENTS.md)、[CONTEXT.md](../CONTEXT.md)、[LESSONS.md](../LESSONS.md)、`docs/*` | 状态真实、规则不冲突、黄灯与技术债可追踪 |

## 必须升级评审的改动

- 工作区外路径、PathGrant、文件删除、写入和上传下载边界。
- 浏览器 session、cookie、权限请求、文件选择和下载事件。
- adapter 执行外部命令的参数或进程模型。
- 数据库 schema 迁移和持久化任务状态。
- `packages/contracts` 中跨模块共享类型。
- 发布、安装、自动更新和打包配置。
- 版本化素材包、外部下载来源、Release tag、归档/逐文件哈希或素材授权记录。

## 合并原则

- 红灯不得合并。
- 黄灯可以合并，但必须写入 [CONTEXT.md](../CONTEXT.md) 或 [TECH_DEBT.md](TECH_DEBT.md)。
- 主观体验验收必须由用户或维护者确认，不能由构建通过代替。
- 安全边界变化必须有文档记录；影响长期架构的变化应新增 ADR。
