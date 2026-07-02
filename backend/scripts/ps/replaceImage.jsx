/**
 * replaceImage.jsx — 替换 PSD 文件中的图片图层
 * 通过环境变量 PS_SCRIPT_PARAMS 接收 JSON 参数
 */

var paramsJson = $.getenv('PS_SCRIPT_PARAMS');
if (!paramsJson) {
  alert('错误：未提供脚本参数');
  $.writeln('ERROR: PS_SCRIPT_PARAMS not found');
  app.quit();
}

try {
  var params = JSON.parse(paramsJson);
  var psdPath = params.psdPath;
  var outputPath = params.outputPath;
  var replacements = params.replacements; // [{layerName, imagePath}]

  var docFile = new File(psdPath);
  if (!docFile.exists) {
    throw new Error('PSD 文件不存在: ' + psdPath);
  }
  var doc = app.open(docFile);

  for (var i = 0; i < replacements.length; i++) {
    var rep = replacements[i];
    var layer = findLayerByName(doc, rep.layerName);

    if (!layer) {
      $.writeln('警告：未找到图层 "' + rep.layerName + '"，跳过');
      continue;
    }

    // 检查替换图片是否存在
    var newImageFile = new File(rep.imagePath);
    if (!newImageFile.exists) {
      $.writeln('警告：替换图片不存在 "' + rep.imagePath + '"，跳过');
      continue;
    }

    // 打开新图片
    var newDoc = app.open(newImageFile);

    // 复制图层到当前文档
    newDoc.activeLayer.duplicate(layer, ElementPlacement.PLACEBEFORE);

    // 删除旧图层
    layer.remove();

    // 重命名新图层为原图层名
    doc.activeLayer.name = rep.layerName;

    // 关闭临时文档
    newDoc.close(SaveOptions.DONOTSAVECHANGES);

    $.writeln('已替换图层 "' + rep.layerName + '" 的图片');
  }

  var outputFile = new File(outputPath);
  var saveOptions = new PhotoshopSaveOptions();
  saveOptions.embedColorProfile = true;
  saveOptions.alphaChannels = true;
  saveOptions.layers = true;
  saveOptions.spotColors = true;

  doc.saveAs(outputFile, saveOptions, true);
  doc.close(SaveOptions.DONOTSAVECHANGES);

  $.writeln('SUCCESS: 图片替换完成，已保存到 ' + outputPath);

} catch (e) {
  $.writeln('ERROR: ' + e.message);
  app.quit();
}

function findLayerByName(parent, name) {
  for (var i = 0; i < parent.layers.length; i++) {
    var layer = parent.layers[i];
    if (layer.name === name) {
      return layer;
    }
    if (layer.typename === 'LayerSet') {
      var found = findLayerByName(layer, name);
      if (found) return found;
    }
  }
  return null;
}
