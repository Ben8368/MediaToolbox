import type { WorkOrder } from '@mediatoolbox/contracts'
import { buildAlgorithmFunctions } from './algorithm.js'

export type ApplyScriptInput = {
  psdPath: string
  outputPath: string
  records: WorkOrder['records']
}

export type ApplyScriptRecord = {
  id: string
  skipped?: boolean
  converged?: boolean
  error?: string
}

export type ApplyScriptOutput = {
  ok: boolean
  outputPath?: string
  results?: ApplyScriptRecord[]
  appliedCount?: number
  skippedCount?: number
  message?: string
}

export function buildApplyScript(input: ApplyScriptInput): string {
  const algoFns = buildAlgorithmFunctions()
  const inputJson = JSON.stringify(input)
  return `
var __input = ${inputJson};
${algoFns}

var __results = [];
var __appliedCount = 0;
var __skippedCount = 0;
var __mainDoc;

try {
  var psdFile = new File(__input.psdPath);
  if (!psdFile.exists) throw new Error("PSD file not found: " + __input.psdPath);
  __mainDoc = app.open(psdFile);

  var dpi = __mainDoc.resolution;
  openLabDoc(dpi);

  var fontIdx = buildFontIndex();
  var records = __input.records;

  for (var ri = 0; ri < records.length; ri++) {
    var rec = records[ri];
    if (!rec.enabled) {
      __results.push({ id: rec.id, skipped: true });
      __skippedCount++;
      continue;
    }
    // Determine what changed
    var newText   = rec.newText   !== undefined ? rec.newText   : rec.originalText;
    var newFamily = rec.newFontFamily !== undefined ? rec.newFontFamily : rec.originalFontFamily;
    var newStyle  = rec.newFontStyle  !== undefined ? rec.newFontStyle  : rec.originalFontStyle;
    var noChange  = (newText === rec.originalText && newFamily === rec.originalFontFamily && newStyle === rec.originalFontStyle);
    if (noChange) {
      __results.push({ id: rec.id, skipped: true });
      __skippedCount++;
      continue;
    }

    var targetPs = resolveFont(fontIdx, newFamily, newStyle, rec.originalFontPs);

    try {
      var adapted = findAdaptedParams(rec, targetPs, newText);
      applyToLayer(__mainDoc, rec, adapted, newText);
      __results.push({ id: rec.id, converged: adapted.converged });
      __appliedCount++;
    } catch(layerErr) {
      __results.push({ id: rec.id, error: layerErr.message || String(layerErr) });
      __skippedCount++;
    }
  }

  closeLabDoc();

  // Save as new PSD copy
  var outFile = new File(__input.outputPath);
  var psdOpts = new PhotoshopSaveOptions();
  psdOpts.embedColorProfile = true;
  psdOpts.maximizeCompatibility = true;
  __mainDoc.saveAs(outFile, psdOpts, true);

  $.writeln("__MTB_JSON__" + JSON.stringify({
    ok: true,
    outputPath: outFile.fsName,
    results: __results,
    appliedCount: __appliedCount,
    skippedCount: __skippedCount
  }));

} catch(mainErr) {
  closeLabDoc();
  $.writeln("__MTB_JSON__" + JSON.stringify({ ok: false, message: mainErr.message || String(mainErr) }));
} finally {
  if (__mainDoc) try { __mainDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(e) {}
}

// ─── Apply params to a real layer (with SO traversal) ──────────
function applyToLayer(doc, rec, adapted, newText) {
  var layer = navigateToLayer(doc, rec);
  if (!layer) throw new Error("Layer not found: " + rec.layerPath);
  writeToTextLayer(layer, adapted, newText);

  // REFINE: real render verification (up to 5 rounds)
  var origH = rec.boundsHPx;
  for (var refIter = 0; refIter < 5; refIter++) {
    var realH = getLayerH(layer);
    var diff = Math.abs(realH - origH);
    var thresh = rec.fakesBold ? Math.max(4.0, origH * 0.01) : Math.max(2.0, origH * 0.005);
    if (diff < thresh) break;
    var ratio = origH / realH;
    adapted.sizePt = Math.round(adapted.sizePt * ratio * 100) / 100;
    if (adapted.leadingPt !== null) adapted.leadingPt = Math.round(adapted.leadingPt * ratio * 100) / 100;
    writeToTextLayer(layer, adapted, newText);
  }
}

// ─── Write params to TextItem (strict ordering per PSA) ────────
function writeToTextLayer(layer, adapted, newText) {
  var ti = layer.textItem;
  // Order: Font → Size → Leading → Tracking → Contents
  ti.font = adapted.fontPs;
  ti.size = new UnitValue(adapted.sizePt, "pt");
  if (adapted.leadingPt !== null) {
    ti.autoLeading = false;
    ti.leading = new UnitValue(adapted.leadingPt, "pt");
  } else {
    ti.autoLeading = true;
  }
  ti.tracking = adapted.tracking;
  ti.contents = newText;
}

// ─── Layer navigation (follow soChain then layerPath) ──────────
function navigateToLayer(doc, rec) {
  var currentDoc = doc;
  var openedSoDocs = [];
  try {
    // Enter each SO in the chain
    for (var si = 0; si < rec.soChain.length; si++) {
      var entry = rec.soChain[si];
      var soContainerPath = entry.layerPath.split("/");
      var soLayer = findLayerByPath(currentDoc.layers, soContainerPath, 0);
      if (!soLayer) throw new Error("SO layer not found: " + entry.layerPath);
      currentDoc.activeLayer = soLayer;
      var desc = new ActionDescriptor();
      app.executeAction(app.stringIDToTypeID("placedLayerEditContents"), desc, DialogModes.NO);
      currentDoc = app.activeDocument;
      openedSoDocs.push(currentDoc);
    }
    // Find the text layer within the final document
    var targetParts = rec.layerPath.split("/");
    return findLayerByPath(currentDoc.layers, targetParts, 0);
  } catch(e) {
    // Close any opened SO docs on error
    for (var ci = openedSoDocs.length - 1; ci >= 0; ci--) {
      try { openedSoDocs[ci].close(SaveOptions.DONOTSAVECHANGES); } catch(ce) {}
    }
    throw e;
  }
}

// After applying, close SO docs from innermost outward (saving changes)
function closeAppliedSoDocs(openedSoDocs) {
  for (var i = openedSoDocs.length - 1; i >= 0; i--) {
    try { openedSoDocs[i].close(SaveOptions.SAVECHANGES); } catch(e) {}
  }
}

function findLayerByPath(layers, pathParts, depth) {
  for (var i = 0; i < layers.length; i++) {
    var layer = layers[i];
    if (layer.name !== pathParts[depth]) continue;
    if (depth === pathParts.length - 1) return layer;
    if (layer.layers) return findLayerByPath(layer.layers, pathParts, depth + 1);
  }
  return null;
}
`
}

export function parseApplyOutput(output: string): ApplyScriptOutput {
  const marker = '__MTB_JSON__'
  const markedLine = output.split(/\r?\n/).find((line) => line.includes(marker))
  const raw = markedLine ? markedLine.slice(markedLine.indexOf(marker) + marker.length) : output.trim()
  try {
    return JSON.parse(raw) as ApplyScriptOutput
  } catch {
    return { ok: false, message: `Failed to parse apply output: ${raw.slice(0, 200)}` }
  }
}
