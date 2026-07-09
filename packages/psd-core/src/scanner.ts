import type { TextLayerRecord } from '@mediatoolbox/contracts'

export function buildScanScript(psdPath: string): string {
  return `
var results = { ok: true, records: [], documentWidth: 0, documentHeight: 0, documentResolution: 72 };
var psdFile = new File(${JSON.stringify(psdPath)});
if (!psdFile.exists) {
  $.writeln("__MTB_JSON__" + JSON.stringify({ ok: false, message: "PSD file not found: " + psdFile.fsName }));
} else {
  var doc;
  try {
    app.displayDialogs = DialogModes.NO;
    doc = app.open(psdFile);
    results.documentWidth = Math.round(Number(doc.width.as("px")));
    results.documentHeight = Math.round(Number(doc.height.as("px")));
    results.documentResolution = doc.resolution;
    var fontMap = buildFontMap();
    var records = [];
    scanLayerList(doc, doc.layers, [], [], records, fontMap, 0);
    results.records = records;
    $.writeln("__MTB_JSON__" + JSON.stringify(results));
  } catch(scanErr) {
    var errMsg = scanErr.message || String(scanErr);
    if (scanErr.number) errMsg += " (code: " + scanErr.number + ")";
    if (scanErr.line) errMsg += " (line: " + scanErr.line + ")";
    $.writeln("__MTB_JSON__" + JSON.stringify({ ok: false, message: errMsg }));
  } finally {
    if (doc) try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch(e) {}
  }
}

function buildFontMap() {
  var m = {};
  try {
    for (var fi = 0; fi < app.fonts.length; fi++) {
      var f = app.fonts[fi];
      m[f.postScriptName] = { family: f.family, style: f.style };
    }
  } catch(e) {}
  return m;
}

function layerBoundsInPx(layer) {
  var b = layer.bounds;
  return {
    left: Math.round(Number(b[0].as("px"))),
    top: Math.round(Number(b[1].as("px"))),
    right: Math.round(Number(b[2].as("px"))),
    bottom: Math.round(Number(b[3].as("px")))
  };
}

function scanLayerList(rootDoc, layers, pathParts, soChain, records, fontMap, depth) {
  if (depth > 3) return;
  for (var i = 0; i < layers.length; i++) {
    try {
      var layer = layers[i];
      var currentPath = pathParts.concat([layer.name]);
      if (layer.typename === "ArtLayer") {
        if (layer.kind === LayerKind.TEXT) {
          var ti = layer.textItem;
          var psName = ti.font;
          var fontInfo = fontMap[psName] || { family: psName, style: "" };
          var bPx = layerBoundsInPx(layer);
          var leadingPt = null;
          try { if (ti.autoLeading === false) leadingPt = Math.round(Number(ti.leading.as("pt")) * 100) / 100; } catch(e) {}
          var fakesBoldVal = false;
          try { fakesBoldVal = !!ti.fauxBold; } catch(e) {}
          var recId = "";
          for (var si = 0; si < soChain.length; si++) { recId += soChain[si].fileRef + "|"; }
          recId += currentPath.join("/");
          records.push({
            id: recId,
            layerId: layer.id,
            layerPath: currentPath.join("/"),
            soChain: soChain.slice(),
            enabled: true,
            originalText: ti.contents,
            originalFontFamily: fontInfo.family,
            originalFontStyle: fontInfo.style,
            originalFontPs: psName,
            originalSizePt: Math.round(Number(ti.size.as("pt")) * 100) / 100,
            originalLeadingPt: leadingPt,
            originalTrackingValue: ti.tracking,
            boundsHPx: bPx.bottom - bPx.top,
            boundsWPx: bPx.right - bPx.left,
            fakesBold: fakesBoldVal
          });
        } else if (layer.kind === LayerKind.SMARTOBJECT) {
          // Skip smart objects for now to avoid nested complexity
          // var soDoc;
          // try {
          //   rootDoc.activeLayer = layer;
          //   var desc = new ActionDescriptor();
          //   app.executeAction(app.stringIDToTypeID("placedLayerEditContents"), desc, DialogModes.NO);
          //   soDoc = app.activeDocument;
          //   var fileRef = "";
          //   try { fileRef = soDoc.fullName.fsName; } catch(e) { fileRef = layer.name; }
          //   var newChain = soChain.concat([{ fileRef: fileRef, layerPath: currentPath.join("/") }]);
          //   scanLayerList(soDoc, soDoc.layers, [], newChain, records, fontMap, depth + 1);
          //   soDoc.close(SaveOptions.DONOTSAVECHANGES);
          // } catch(soErr) {
          //   if (soDoc) try { soDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(e) {}
          // }
        }
      } else if (layer.typename === "LayerSet") {
        scanLayerList(rootDoc, layer.layers, currentPath, soChain, records, fontMap, depth);
      }
    } catch(layerErr) {
      // Skip problematic layers instead of failing entire scan
      continue;
    }
  }
}
`
}

export type ScanScriptOutput = {
  ok: boolean
  records?: TextLayerRecord[]
  documentWidth?: number
  documentHeight?: number
  documentResolution?: number
  message?: string
}

export function parseScanOutput(output: string): ScanScriptOutput {
  const marker = '__MTB_JSON__'
  const markedLine = output.split(/\r?\n/).find((line) => line.includes(marker))
  const raw = markedLine ? markedLine.slice(markedLine.indexOf(marker) + marker.length) : output.trim()
  try {
    return JSON.parse(raw) as ScanScriptOutput
  } catch {
    return { ok: false, message: `Failed to parse scanner output: ${raw.slice(0, 200)}` }
  }
}
