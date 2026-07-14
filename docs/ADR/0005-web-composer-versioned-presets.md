# ADR 0005: Web Composer 版本化只读预设与隔离导出

- 状态：已接受
- 日期：2026-07-13

## 背景

Web Composer 需要把 Html2Video demo 的网页预设接入 MediaToolbox 桌面工作台。产品目标是在预设基础上替换文案、图片、视频和颜色，而不是把预设变成任意 DOM 编辑器；因此预设结构和最终导出必须有稳定、可审计的边界。随着内置预设和可编辑元素增加，平铺全部字段的左栏会形成超长表单，还无法表达 Logo、图标、内容类型替换、单元素样式、偏移与隐藏恢复，因此需要统一的 Slot v2 能力模型和预览区点选协议。

## 决策

- 每个预设具有稳定 ID、整数版本、上游源码/样式 SHA 和明确的 Slot v2 manifest。
- Slot manifest 声明稳定 Slot ID、分组、可隐藏性、设计坐标偏移范围，以及 `text`、`icon`、`image`、`media` 中允许使用的编辑器和候选类型；状态保存 `activeKind`、`visible`、偏移、候选内容与独立主题变量。
- 预设组件、DOM、样式和动画源码保持只读；预设只通过显式 `data-wc-slot` 将 manifest Slot 绑定到浏览器原生 DOM，通用编辑器不推断任意 DOM，也不按预设 ID 增加专属表单。
- 预设源码与 CSS 由 SHA-256 完整性测试锁定；结构性调整必须显式升级预设版本并更新锁。
- 预设运行在独立同源 sandbox iframe。iframe 使用目标输出像素尺寸，工作台只缩放外层显示；编辑模式允许在预览区点击已声明 Slot，交互预览模式保留预设原有行为。
- iframe 回传 Slot 选择和设计坐标，左侧上下文 Inspector 仅根据当前 Slot manifest 生成控件；可搜索、分组的元素大纲始终保留隐藏 Slot，作为隐藏后重新选择和恢复的入口。
- 每个工作台实例创建独立 `sessionId`，所有父窗口/iframe 消息必须校验消息结构、source、origin、session、预设 ID 与版本，避免多窗口、多预览实例和旧版本消息串扰。
- hover/selection overlay 与捕获根节点分层，overlay 位于 capture root 之外并显式排除捕获；选择框、标签和坐标反馈不得进入 PNG 或视频。
- 浏览器运行时捕获 PNG 或 WebM；API 校验格式签名、预设版本、像素总量、帧率、时长和体积上限。
- PNG 持久化和 WebM 到 H.264 MP4 的编码进入统一 Job/Asset 模型；MP4 编码由 `web-render-worker` 通过 ffmpeg adapter 完成。
- 输出路径与文件名完全由服务端生成，并限制在 `/Workspace/Exports`。

## 后果

好处：

- 编辑不会无意破坏预设布局，预设版本可追溯。
- 用户可以直接从预览定位元素，左栏复杂度由当前 Slot 能力决定，不随整套预设文案数量线性增长。
- 新增预设只需提供版本化 manifest、默认状态和显式 Slot 绑定，元素大纲与上下文 Inspector 保持通用。
- 隐藏元素可从大纲恢复；多窗口和多 iframe 通过 session 隔离，选择反馈不会污染导出。
- 预览尺寸与导出尺寸一致，工作台窗口缩放不影响成片像素。
- 导出状态、取消、日志和产物索引复用现有 Job/Asset 体系。

代价：

- 新增字段或调整结构必须走预设版本升级，不能在通用编辑器中任意拖拽 DOM。
- 预设作者必须维护 Slot ID、manifest 能力与 DOM 绑定的一致性；混合文案或内联图标需要拆成可独立命中的明确 Slot。
- Inspector 只呈现声明能力，因此需要新增通用编辑能力时必须先扩展共享契约与状态校验，不能在单个预设内私自绕过。
- 默认字体与媒体的离线确定性已在后续决策中落地：字体和必要图片随源码管理，8 个默认 MP4 由版本化外部资源包分发；详见 [ADR 0006](0006-web-composer-external-video-assets.md)。
- 高分辨率、长时视频的浏览器逐帧捕获成本较高，需要继续做桌面端压力验收。

## 关联文档

- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_API_CONTRACT.md`
- `docs/API_VALIDATION.md`
- `docs/UI_COMPAT.md`
- `docs/ADR/0006-web-composer-external-video-assets.md`
