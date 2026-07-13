# ADR 0005: Web Composer 版本化只读预设与隔离导出

- 状态：已接受
- 日期：2026-07-13

## 背景

Web Composer 需要把 Html2Video demo 的网页预设接入 MediaToolbox 桌面工作台。产品目标是在预设基础上替换文案、图片、视频和颜色，而不是把预设变成任意 DOM 编辑器；因此预设结构和最终导出必须有稳定、可审计的边界。

## 决策

- 每个预设具有稳定 ID、整数版本、上游源码/样式 SHA 和明确的可编辑 slot manifest。
- 预设组件、DOM、样式和动画源码保持只读；编辑状态只覆盖 manifest 声明的文案、媒体、字体和颜色变量。
- 预设源码与 CSS 由 SHA-256 完整性测试锁定；结构性调整必须显式升级预设版本并更新锁。
- 预设运行在独立同源 sandbox iframe。iframe 使用目标输出像素尺寸，工作台只缩放外层显示。
- 浏览器运行时捕获 PNG 或 WebM；API 校验格式签名、预设版本、像素总量、帧率、时长和体积上限。
- PNG 持久化和 WebM 到 H.264 MP4 的编码进入统一 Job/Asset 模型；MP4 编码由 `web-render-worker` 通过 ffmpeg adapter 完成。
- 输出路径与文件名完全由服务端生成，并限制在 `/Workspace/Exports`。

## 后果

好处：

- 编辑不会无意破坏预设布局，预设版本可追溯。
- 预览尺寸与导出尺寸一致，工作台窗口缩放不影响成片像素。
- 导出状态、取消、日志和产物索引复用现有 Job/Asset 体系。

代价：

- 新增字段或调整结构必须走预设版本升级，不能在通用编辑器中任意拖拽 DOM。
- 默认远程字体和媒体仍依赖网络可用性；后续若需离线确定性，需要把对应资产纳入版本化资源包。
- 高分辨率、长时视频的浏览器逐帧捕获成本较高，需要继续做桌面端压力验收。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_API_CONTRACT.md`
- `docs/API_VALIDATION.md`
- `docs/UI_COMPAT.md`
