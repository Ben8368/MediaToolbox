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
