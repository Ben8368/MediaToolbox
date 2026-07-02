/**
 * replaceText.jsx — 替换 PSD 文件中的文案
 * 通过环境变量 PS_SCRIPT_PARAMS 接收 JSON 参数
 */

// 从环境变量读取参数
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
  var replacements = params.replacements; // [{layerName, oldText?, newText}]

  // 打开 PSD 文件
  var docFile = new File(psdPath);
  if (!docFile.exists) {
    throw new Error('PSD 文件不存在: ' + psdPath);
  }
  var doc = app.open(docFile);

  // 遍历替换项
  for (var i = 0; i < replacements.length; i++) {
    var rep = replacements[i];
    var layer = findLayerByName(doc, rep.layerName);

    if (!layer) {
      $.writeln('警告：未找到图层 "' + rep.layerName + '"，跳过');
      continue;
    }

    if (layer.kind !== LayerKind.TEXT) {
      $.writeln('警告：图层 "' + rep.layerName + '" 不是文本图层，跳过');
      continue;
    }

    var textItem = layer.textItem;

    // 如果指定了 oldText，进行替换；否则直接覆盖
    if (rep.oldText) {
      var currentText = textItem.contents;
      textItem.contents = currentText.replace(new RegExp(rep.oldText, 'g'), rep.newText);
    } else {
      textItem.contents = rep.newText;
    }

    $.writeln('已替换图层 "' + rep.layerName + '" 的文案');
  }

  // 保存到输出路径
  var outputFile = new File(outputPath);
  var saveOptions = new PhotoshopSaveOptions();
  saveOptions.embedColorProfile = true;
  saveOptions.alphaChannels = true;
  saveOptions.layers = true;
  saveOptions.spotColors = true;

  doc.saveAs(outputFile, saveOptions, true);
  doc.close(SaveOptions.DONOTSAVECHANGES);

  $.writeln('SUCCESS: 文案替换完成，已保存到 ' + outputPath);

} catch (e) {
  $.writeln('ERROR: ' + e.message);
  app.quit();
}

/**
 * 递归查找图层（支持图层组）
 */
function findLayerByName(parent, name) {
  for (var i = 0; i < parent.layers.length; i++) {
    var layer = parent.layers[i];
    if (layer.name === name) {
      return layer;
    }
    // 如果是图层组，递归查找
    if (layer.typename === 'LayerSet') {
      var found = findLayerByName(layer, name);
      if (found) return found;
    }
  }
  return null;
}
