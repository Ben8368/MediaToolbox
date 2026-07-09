# 安全政策

MediaToolbox 是本地媒体工作流应用，涉及本地文件、下载、浏览器 session、转码和 Photoshop 自动化。安全边界优先级高于功能便利性。

## 支持范围

当前仓库尚未发布稳定版本。安全问题请基于 `main` 分支最新状态报告，并注明本地操作系统、Node.js 版本、启动方式和复现步骤。

## 报告方式

如果仓库托管平台已启用私密安全通道，请优先使用该通道。否则请先通过维护者指定的私密联系方式报告，不要在公开 issue 中贴出可直接利用的漏洞细节、路径、cookie、token 或本机文件内容。

报告建议包含：

- 受影响模块，例如 `apps/api`、`apps/desktop`、`workers/*` 或某个 adapter。
- 复现步骤和最小输入。
- 影响范围，例如任意文件读取、任意文件写入、命令注入、session 泄露、权限绕过。
- 是否需要真实第三方工具，例如 `yt-dlp`、`ffmpeg` 或 Photoshop。

## 安全边界

- 前端不得直接读取或拼接工作区外物理路径。
- 裸盘符、UNC、`..` 逃逸和工作区外路径默认由 API 拒绝。
- 工作区外访问必须通过 PathGrant；读授权和写授权分离，写入工作区外必须二次确认。
- 桌面专用写端点必须同时校验桌面 marker 与启动期 desktop token；token 只在 Electron 主进程与本地 API 之间传递，不暴露给 Web UI。
- Electron 主进程持有浏览器 session、文件选择和下载事件；Web UI 只提交用户意图并展示状态。
- 不向 Web UI 暴露原始 cookie、session 或本地敏感路径。
- 第三方工具调用必须走 adapter，禁止把用户输入直接拼接成 shell 命令。
- 下载、转码、PSD 渲染等产物默认写入受控工作区，除非携带有效写授权。

## 不应提交的内容

- `.env`、token、cookie、账号凭据。
- 本机绝对路径、公司内网地址、私有媒体文件或客户 PSD。
- `node_modules`、构建产物、缓存、日志和本地工具目录。

## 处理原则

确认安全问题后，应优先：

1. 复现并建立最小测试或验证步骤。
2. 收紧契约或权限边界。
3. 更新 [CONTEXT.md](CONTEXT.md)、[docs/TECH_DEBT.md](docs/TECH_DEBT.md) 或相关 ADR。
4. 通过 `npm run verify` 后再合并。
