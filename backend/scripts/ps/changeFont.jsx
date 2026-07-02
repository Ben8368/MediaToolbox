/**
 * changeFont.jsx — 修改 PSD 文件中的字体
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
  var layerNames = params.layerNames; // string[]
  var fontFamily = params.fontFamily;
  var fontSize = params.fontSize; // number | undefined

  var docFile = new File(psdPath);
  if (!docFile.exists) {
    throw new Error('PSD 文件不存在: ' + psdPath);
  }
  var doc = app.open(docFile);

  for (var i = 0; i < layerNames.length; i++) {
    var layerName = layerNames[i];
    var layer = findLayerByName(doc, layerName);

    if (!layer) {
      $.writeln('警告：未找到图层 "' + layerName + '"，跳过');
      continue;
    }

    if (layer.kind !== LayerKind.TEXT) {
      $.writeln('警告：图层 "' + layerName + '" 不是文本图层，跳过');
      continue;
    }

    var textItem = layer.textItem;
    textItem.font = fontFamily;

    if (fontSize !== undefined && fontSize !== null) {
      textItem.size = new UnitValue(fontSize, 'pt');
    }

    $.writeln('已修改图层 "' + layerName + '" 的字体为 ' + fontFamily);
  }

  var outputFile = new File(outputPath);
  var saveOptions = new PhotoshopSaveOptions();
  saveOptions.embedColorProfile = true;
  saveOptions.alphaChannels = true;
  saveOptions.layers = true;
  saveOptions.spotColors = true;

  doc.saveAs(outputFile, saveOptions, true);
  doc.close(SaveOptions.DONOTSAVECHANGES);

  $.writeln('SUCCESS: 字体修改完成，已保存到 ' + outputPath);

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
