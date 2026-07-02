/**
 * translateLayers.jsx — 翻译 PSD 文件中的图层文案
 * 通过环境变量 PS_SCRIPT_PARAMS 接收 JSON 参数
 * 注意：此脚本仅提供框架，实际翻译需要调用外部翻译 API
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
  var targetLanguage = params.targetLanguage;

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
    var originalText = textItem.contents;

    // TODO: 调用翻译 API（需要外部实现）
    // 当前占位实现：在原文后添加 [targetLanguage] 标记
    var translatedText = originalText + ' [' + targetLanguage + ']';

    textItem.contents = translatedText;
    $.writeln('已翻译图层 "' + layerName + '": ' + originalText + ' -> ' + translatedText);
  }

  var outputFile = new File(outputPath);
  var saveOptions = new PhotoshopSaveOptions();
  saveOptions.embedColorProfile = true;
  saveOptions.alphaChannels = true;
  saveOptions.layers = true;
  saveOptions.spotColors = true;

  doc.saveAs(outputFile, saveOptions, true);
  doc.close(SaveOptions.DONOTSAVECHANGES);

  $.writeln('SUCCESS: 图层翻译完成，已保存到 ' + outputPath);
  $.writeln('注意：当前为占位实现，实际翻译需要接入外部翻译服务');

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
