# Photoshop 工作台 PSD 测试样本

本目录存放用于验证 MediaToolbox PSD 工作台后端能力的 fixture 文件，需配合真实 Photoshop 运行时使用。

文件说明：
- `smoke.psd`：小体积烟测模板，用于快速后端冒烟检查。
- `baseline.psd`：较完整的基线模板，用于更全面的扫描 / 应用检查。

建议手动验证流程：
1. 若自动检测找不到 Photoshop，先配置环境变量 `MEDIATOOLBOX_PHOTOSHOP_COMMAND`。
2. 运行 `npm run psd:roundtrip -- --fixture smoke --mode quick` 执行快速烟测（scan/apply 往返）。
3. 烟测通过且所需字体就绪后，运行 `npm run psd:roundtrip -- --fixture baseline --mode full` 执行完整基线测试。

往返测试命令会将生成的 PSD 和 `comparison.json` 写入 `.tmp/psd-roundtrip/`，不会修改本目录中的 fixture 文件。
