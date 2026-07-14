# Web Composer 素材包

Web Composer 的默认视频保持原始字节不变，但不再进入源码仓库。版本化清单位于
`manifest.json`，运行时安装位置保持为
`apps/web/public/static/web-composer/videos/`，所以预设中的静态 URL 无需变化。

## 常用命令

- `npm run assets:web-composer:verify`：校验本地 8 个视频的大小与 SHA-256。
- `npm run assets:web-composer:ensure`：本地素材有效时直接返回，否则下载并安装固定 Release Asset。
- `npm run assets:web-composer:install`：强制执行下载、归档校验和文件校验。
- `npm run assets:web-composer:pack`：从已校验的视频生成 `.artifacts/web-composer/` 下的发布包。

安装命令可用 `MEDIATOOLBOX_WEB_COMPOSER_ASSET_SOURCE` 临时覆盖下载来源；该值可为
HTTP(S) URL、`file://` URL 或本地归档路径。正式源码清单必须固定归档 SHA-256，不能使用
浮动地址或跳过校验。

## 发布约束

1. 只有清单内全部文件逐项校验通过后才能生成素材包。
2. 将生成的 `web-composer-assets-v1.tar.gz` 上传到清单声明的 GitHub Release tag。
3. 将发布包 SHA-256 写入 `manifest.json`，再从 Release URL 执行一次全新安装验收。
4. Electron 候选构建前必须运行素材校验；源码归档可以不含视频，安装包必须包含视频。

## 治理与回滚

- 当前资源包只包含清单声明的 8 个默认 MP4；字体、CSS 和 Lumora 前景图仍随源码仓库管理。
- 每次内容变化都必须提升 `packageVersion`、使用新 tag/归档名并更新归档与逐文件 SHA-256；已发布 tag 和归档不可覆盖。
- PR 必须说明兼容的预设/产品范围、素材来源、版权/许可证和再分发授权，并附本地安装、远端全新安装及 renderer 入包结果。
- 已被源码或产品引用的归档长期保留。回滚时恢复上一版清单，不能删除旧归档、关闭哈希校验或改用浮动下载地址。
- 当前默认视频的逐项来源与再分发授权记录尚未建立，因此资源包只用于开发和内部候选构建，不得随公开产品发布。

长期决策见 [ADR 0006](../../docs/ADR/0006-web-composer-external-video-assets.md)，跨产品发布门禁见 [RELEASE.md](../../docs/RELEASE.md)。
