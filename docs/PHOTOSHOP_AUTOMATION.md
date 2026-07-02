# Photoshop 自动化服务

Photoshop 自动化能力已集成到 MediaToolbox 后端，通过 ExtendScript 脚本实现 PSD 文件的自动化处理。

## 功能列表

### 1. 替换文案 (replace-text)
替换 PSD 文件中指定图层的文本内容。

**端点**: `POST /api/ps/replace-text`

**请求体**:
```json
{
  "psdPath": "path/to/input.psd",
  "outputPath": "path/to/output.psd",
  "replacements": [
    {
      "layerName": "标题",
      "oldText": "原文案",
      "newText": "新文案"
    },
    {
      "layerName": "副标题",
      "newText": "直接覆盖文案（不指定 oldText）"
    }
  ]
}
```

### 2. 修改字体 (change-font)
修改指定图层的字体族和字号。

**端点**: `POST /api/ps/change-font`

**请求体**:
```json
{
  "psdPath": "path/to/input.psd",
  "outputPath": "path/to/output.psd",
  "layerNames": ["标题", "正文"],
  "fontFamily": "Microsoft YaHei",
  "fontSize": 24
}
```

### 3. 替换图片 (replace-image)
替换指定图层的图片内容。

**端点**: `POST /api/ps/replace-image`

**请求体**:
```json
{
  "psdPath": "path/to/input.psd",
  "outputPath": "path/to/output.psd",
  "replacements": [
    {
      "layerName": "背景图",
      "imagePath": "path/to/new-background.jpg"
    },
    {
      "layerName": "产品图",
      "imagePath": "path/to/product.png"
    }
  ]
}
```

### 4. 翻译图层 (translate-layers)
翻译指定图层的文案（当前为占位实现，需接入外部翻译服务）。

**端点**: `POST /api/ps/translate-layers`

**请求体**:
```json
{
  "psdPath": "path/to/input.psd",
  "outputPath": "path/to/output.psd",
  "layerNames": ["标题", "副标题"],
  "targetLanguage": "en"
}
```

## 任务管理

所有 Photoshop 任务都通过统一的任务队列系统管理，支持：

- **取消任务**: `POST /api/ps/tasks/:id/cancel`
- **删除记录**: `DELETE /api/ps/tasks/:id`
- **查询状态**: 通过 `GET /api/fetch/tasks` 查看所有活动任务（包括 Photoshop 任务）

## 环境配置

### 必需配置

1. **Photoshop 可执行文件路径**（默认值见下方，可通过环境变量覆盖）：
   ```bash
   PS_EXECUTABLE="C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe"
   ```

2. **工作目录**（所有文件路径基于此目录，确保安全边界）：
   ```bash
   WORK_DIR="C:\MediaToolbox"
   ```

### 可选配置

- `MAX_CONCURRENT_DOWNLOADS`: 最大并发任务数（默认 2）
- `PS_TIMEOUT_MS`: Photoshop 脚本执行超时时间（默认 10 分钟）

## 技术架构

```
┌─────────────────────────────────────────────────┐
│  API Layer (routes/photoshop.ts)               │
│  - 参数校验                                     │
│  - 路径安全检查                                 │
│  - 任务创建与入队                               │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  Service Layer (services/photoshop/)           │
│  - operations.ts: 高层操作封装                 │
│  - executor.ts: ExtendScript 调用封装          │
│  - index.ts: 任务队列 worker                   │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  ExtendScript Layer (scripts/ps/*.jsx)         │
│  - replaceText.jsx: 文案替换                   │
│  - changeFont.jsx: 字体修改                    │
│  - replaceImage.jsx: 图片替换                  │
│  - translateLayers.jsx: 翻译图层               │
└─────────────────────────────────────────────────┘
```

## 安全机制

1. **路径越界防护**: 所有文件路径必须在 `WORK_DIR` 内
2. **文件存在性校验**: 处理前检查 PSD 和替换图片是否存在
3. **进程超时控制**: 防止脚本执行卡死
4. **参数注入防护**: 通过环境变量传递 JSON 参数，避免命令行注入

## 扩展指南

### 添加新操作

1. 在 `operations.ts` 中添加新函数
2. 在 `scripts/ps/` 下创建对应的 `.jsx` 脚本
3. 在 `routes/photoshop.ts` 中添加新端点
4. 在 `index.ts` 的 worker switch 中添加分支

### 接入真实翻译服务

修改 `translateLayers.jsx`，在脚本中调用外部翻译 API（需要 Photoshop 支持的网络库，或通过 Node.js 预处理翻译结果）。

## 测试检查清单

- [ ] Photoshop 可执行文件路径正确
- [ ] 准备测试 PSD 文件（包含文本图层和图片图层）
- [ ] 提交替换文案任务，确认输出文件生成
- [ ] 提交修改字体任务，确认字体变更生效
- [ ] 提交替换图片任务，确认图片替换成功
- [ ] 测试任务取消功能
- [ ] 测试路径越界保护（尝试访问 WORK_DIR 外的路径）
- [ ] 测试超时机制（使用超大 PSD 文件）

## 已知限制

1. **翻译功能为占位实现**: 需要接入真实翻译服务
2. **图层查找**: 当前通过图层名称精确匹配，不支持模糊查找
3. **批量处理**: 暂未实现批量处理多个 PSD 文件的便捷接口
4. **进度反馈**: Photoshop 脚本执行过程中无法实时更新进度

## 后续优化方向

1. 实现批量处理接口
2. 添加 PSD 文件预览功能
3. 集成真实翻译服务（Claude API / Google Translate）
4. 支持图层模糊匹配和正则表达式
5. 添加脚本执行日志收集
6. 前端 UI 集成（PS 工作台应用）
