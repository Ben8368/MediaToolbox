# ADR 0006: Web Composer 默认视频与源码仓库分离

- 状态：已接受
- 日期：2026-07-14
- 更新：2026-07-23（补充固定来源的非归档视频）

## 背景

Web Composer 的 8 个基础 MP4 合计约 118 MiB。继续把它们写入源码 Git 对象会放大 clone、fetch 和历史存储成本，但开发、CI 和 Electron 安装包仍需要可重复、离线可用的固定字节。新增预设还可能引用无法确认再分发权、但可从固定上游地址取得的视频；这类素材不能直接重新打入现有 Release 归档。

字体、CSS 和必要图片体积较小且与页面结构紧密耦合，仍适合随源码版本管理。因此本决策只拆分默认 MP4，不把所有静态素材一概外置。

## 决策

- 源码仓库不跟踪 `apps/web/public/static/web-composer/videos/`，只保存版本化清单、安装/校验工具和操作说明。
- `manifest.json` 固定基础素材包版本、安装路径、仓库、不可变 tag、归档名、下载 URL、归档 SHA-256 以及逐文件大小和 SHA-256。
- `supplemental.json` 只声明不重新分发的补充视频，逐项固定上游 HTTPS URL、大小和 SHA-256；安装后与基础视频共享本地静态目录，运行时不得直接访问远端。
- `npm run dev`、`npm run dev:web` 和 Web 构建在需要时执行素材 `ensure`；本地文件全部有效时不得访问网络。
- CI 和产品候选构建从固定 Release Asset 与补充视频的固定上游来源安装资源，完成归档与逐文件校验后再构建；Electron renderer 产物必须包含完整视频。
- `pack` 只生成 `manifest.json` 声明的基础归档，不把 `supplemental.json` 视频重新分发进 Release Asset。
- 基础素材内容变化必须使用新版本、新 tag 和新归档；补充素材内容变化必须更新来源、大小与 SHA-256。两类来源均禁止浮动地址或跳过哈希校验。
- 已被任一源码或产品版本引用的归档长期保留；回滚通过恢复上一版清单完成，不关闭哈希校验。
- 每个素材版本必须记录兼容范围、来源、版权/许可证和再分发授权。记录缺失时仅允许开发与内部候选构建，不得进入公开产品发布。

## 后果

好处：

- 源码 Git 历史不再承载大体积视频，clone 和长期存储成本稳定。
- 清单哈希保证开发、CI 和安装包使用相同字节，远端归档损坏或被替换时会明确失败。
- 运行时静态 URL 不变，预设组件和导出流程无需感知分发方式。

代价：

- 全新开发环境和 CI 首次构建依赖外部 Release Asset 与补充素材上游的可用性。
- 发布者必须长期维护旧归档，并把素材来源和授权纳入发布门禁。
- hosted runner 不应被假定预装外部工具；真实转码测试仍需由 CI 显式准备 `ffmpeg`。

## 关联文档

- `assets/web-composer/README.md`
- `assets/web-composer/manifest.json`
- `assets/web-composer/supplemental.json`
- `docs/ARCHITECTURE.md`
- `docs/RELEASE.md`
- `SECURITY.md`
- `docs/ADR/0005-web-composer-versioned-presets.md`
