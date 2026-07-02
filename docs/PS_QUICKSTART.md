# Photoshop 自动化 - 快速入门

## 前置条件

1. **安装 Photoshop**: 确保 Photoshop 2024+ 已安装
2. **设置环境变量**（可选，如果不在默认路径）：
   ```bash
   export PS_EXECUTABLE="C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe"
   ```

## 启动服务

```bash
# 从项目根目录启动
npm start
```

服务将在 `http://localhost:8080` 启动。

## 快速测试

### 1. 替换 PSD 文件中的文案

```bash
curl -X POST http://localhost:8080/api/ps/replace-text \
  -H "Content-Type: application/json" \
  -d '{
    "psdPath": "test/sample.psd",
    "outputPath": "test/output.psd",
    "replacements": [
      {
        "layerName": "标题",
        "newText": "新的标题文案"
      }
    ]
  }'
```

**响应示例**：
```json
{
  "ok": true,
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

### 2. 查询任务状态

```bash
curl http://localhost:8080/api/fetch/tasks
```

**响应示例**：
```json
{
  "ok": true,
  "tasks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "photoshop",
      "name": "替换文案: test/sample.psd",
      "status": "completed",
      "progress": 100,
      "stage": "done",
      "output_files": ["test/output.psd"]
    }
  ]
}
```

### 3. 修改字体

```bash
curl -X POST http://localhost:8080/api/ps/change-font \
  -H "Content-Type: application/json" \
  -d '{
    "psdPath": "test/sample.psd",
    "outputPath": "test/output-font.psd",
    "layerNames": ["标题", "正文"],
    "fontFamily": "Microsoft YaHei",
    "fontSize": 24
  }'
```

### 4. 替换图片

```bash
curl -X POST http://localhost:8080/api/ps/replace-image \
  -H "Content-Type: application/json" \
  -d '{
    "psdPath": "test/sample.psd",
    "outputPath": "test/output-img.psd",
    "replacements": [
      {
        "layerName": "背景图",
        "imagePath": "test/new-bg.jpg"
      }
    ]
  }'
```

### 5. 取消任务

```bash
curl -X POST http://localhost:8080/api/ps/tasks/{task_id}/cancel
```

## 常见问题

### Q: 找不到 Photoshop 可执行文件
**A**: 设置环境变量 `PS_EXECUTABLE` 指向正确路径。

### Q: 任务状态一直是 pending
**A**: 检查 Photoshop 是否正确安装，查看后端日志排查错误。

### Q: 路径越界错误
**A**: 确保所有文件路径都在 `WORK_DIR` 目录内（默认为项目根目录）。

### Q: 脚本执行超时
**A**: 增大超时时间（默认 10 分钟），或优化 PSD 文件大小。

## 下一步

- 查看完整文档：`docs/PHOTOSHOP_AUTOMATION.md`
- 集成前端 UI（PS 工作台应用）
- 接入真实翻译服务
- 实现批量处理功能

## 技术支持

遇到问题请查看：
1. 后端日志输出
2. Photoshop ExtendScript 错误信息
3. 任务状态中的 `error` 字段
