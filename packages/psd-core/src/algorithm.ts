/**
 * Generates the ExtendScript (ES3) adaptive typography algorithm functions.
 * Ported from PSA (https://github.com/Ben8368/PSA).
 * All functions are self-contained and share a lab document via global labDoc/labLayer vars.
 */
export function buildAlgorithmFunctions(): string {
  return `
// ─── Lab document ──────────────────────────────────────────────
var gLabDoc = null;
var gLabLayer = null;

function openLabDoc(dpi) {
  gLabDoc = app.documents.add(
    new UnitValue(1000, "px"), new UnitValue(1000, "px"),
    dpi, "MTB_AdaptLab", NewDocumentMode.RGB, DocumentFill.WHITE
  );
  gLabLayer = gLabDoc.artLayers.add();
  gLabLayer.kind = LayerKind.TEXT;
}

function closeLabDoc() {
  if (gLabDoc) { try { gLabDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(e) {} }
  gLabDoc = null; gLabLayer = null;
}

// ─── Measurement helpers ────────────────────────────────────────
function getLayerH(layer) {
  var b = layer.bounds;
  return Math.abs(Number(b[3].as("px")) - Number(b[1].as("px")));
}
function getLayerW(layer) {
  var b = layer.bounds;
  return Math.abs(Number(b[2].as("px")) - Number(b[0].as("px")));
}

function setupLabText(text, psFont, sizePt, isMultiline, boxWPx, boxHPx) {
  var ti = gLabLayer.textItem;
  if (isMultiline) {
    ti.kind = TextType.PARAGRAPHTEXT;
    ti.width  = new UnitValue(boxWPx  || 800, "px");
    ti.height = new UnitValue(boxHPx  || 800, "px");
  } else {
    ti.kind = TextType.POINTTEXT;
  }
  ti.font    = psFont;
  ti.size    = new UnitValue(sizePt, "pt");
  ti.autoLeading = true;
  ti.contents = text;
}

function setLabSize(sizePt, leadingPt) {
  var ti = gLabLayer.textItem;
  ti.size = new UnitValue(sizePt, "pt");
  if (leadingPt !== null) {
    ti.autoLeading = false;
    ti.leading = new UnitValue(leadingPt, "pt");
  } else {
    ti.autoLeading = true;
  }
}

// ─── Font index helper ──────────────────────────────────────────
function buildFontIndex() {
  var idx = {};
  for (var i = 0; i < app.fonts.length; i++) {
    var f = app.fonts[i];
    if (!idx[f.family]) idx[f.family] = {};
    idx[f.family][f.style] = f.postScriptName;
  }
  return idx;
}

function resolveFont(fontIdx, family, style, fallbackPs) {
  if (!family) return fallbackPs;
  var familyFonts = fontIdx[family];
  if (!familyFonts) {
    // try removing spaces
    var noSpace = family.replace(/ /g, "");
    for (var k in fontIdx) {
      if (k.replace(/ /g, "") === noSpace) { familyFonts = fontIdx[k]; break; }
    }
  }
  if (!familyFonts) return fallbackPs;
  if (!style) {
    // return first available style
    for (var s in familyFonts) return familyFonts[s];
    return fallbackPs;
  }
  if (familyFonts[style]) return familyFonts[style];
  // fuzzy match by style keywords
  var targetLower = style.toLowerCase();
  var best = null, bestScore = 0;
  for (var st in familyFonts) {
    var stLower = st.toLowerCase();
    var score = 0;
    if (stLower === targetLower) return familyFonts[st];
    if (stLower.indexOf(targetLower) !== -1 || targetLower.indexOf(stLower) !== -1) score = 5;
    var targetWords = targetLower.split(/[ -]/);
    var stWords = stLower.split(/[ -]/);
    for (var wi = 0; wi < targetWords.length; wi++) {
      for (var wj = 0; wj < stWords.length; wj++) {
        if (targetWords[wi] === stWords[wj]) score += 2;
      }
    }
    if (score > bestScore) { bestScore = score; best = familyFonts[st]; }
  }
  return best || fallbackPs;
}

// ─── Scale calibration ──────────────────────────────────────────
// Measure the same text/font/size in lab doc, derive lab→doc scale factor.
function calibrateScale(text, psFont, origSizePt, origBoundsH, isMultiline, boxWPx, boxHPx) {
  setupLabText(text, psFont, origSizePt, isMultiline, boxWPx, boxHPx);
  var labH = getLayerH(gLabLayer);
  if (labH <= 0) labH = origBoundsH;
  return origBoundsH / labH;  // scale factor
}

// ─── Phase 1: Binary search for initial size ────────────────────
function phase1(text, psFont, targetH, isMultiline, boxWPx, boxHPx) {
  var ti = gLabLayer.textItem;
  if (isMultiline) {
    ti.kind = TextType.PARAGRAPHTEXT;
    ti.width  = new UnitValue(boxWPx || 800, "px");
    ti.height = new UnitValue(boxHPx || 800, "px");
  } else {
    ti.kind = TextType.POINTTEXT;
  }
  ti.font = psFont;
  ti.autoLeading = true;
  ti.contents = text;

  var lo = 1, hi = 500, bestSize = 72;
  for (var i = 0; i < 10; i++) {
    var mid = (lo + hi) / 2;
    ti.size = new UnitValue(mid, "pt");
    var h = getLayerH(gLabLayer);
    var err = Math.abs(h - targetH) / targetH;
    if (err < 0.04) { bestSize = mid; break; }
    if (h < targetH) lo = mid;
    else hi = mid;
    bestSize = mid;
    if (hi - lo < 2) break;
  }
  return bestSize;
}

// ─── Phase 2 helpers ────────────────────────────────────────────
var PHASE2_MAX_ROUNDS = 5;
var PHASE2_SUB_ITERS  = 7;

function convergenceThreshold(targetH, fakesBold) {
  if (fakesBold) return Math.max(2.0, targetH * 0.01);
  return Math.max(1.0, targetH * 0.005);
}

// Sub-A: binary-search leading in [sizePt*0.8, sizePt*2.5]
function subA(ti, text, targetH, sizePt) {
  var loL = sizePt * 0.8, hiL = sizePt * 2.5;
  ti.autoLeading = false;
  var bestLeading = sizePt * 1.2;
  for (var j = 0; j < PHASE2_SUB_ITERS; j++) {
    var midL = (loL + hiL) / 2;
    ti.leading = new UnitValue(midL, "pt");
    var h = getLayerH(gLabLayer);
    if (h < targetH) loL = midL;
    else hiL = midL;
    bestLeading = midL;
  }
  return bestLeading;
}

// Sub-B: micro-adjust size ±3%, re-anchor leading
function subB(ti, text, targetH, sizePt, leadingPt) {
  var loS = sizePt * 0.97, hiS = sizePt * 1.03;
  for (var j = 0; j < 5; j++) {
    var midS = (loS + hiS) / 2;
    ti.size = new UnitValue(midS, "pt");
    if (leadingPt !== null) {
      var anchorLeading = midS * (leadingPt / sizePt);
      ti.leading = new UnitValue(anchorLeading, "pt");
    }
    var h = getLayerH(gLabLayer);
    if (h < targetH) loS = midS;
    else hiS = midS;
    sizePt = midS;
  }
  return sizePt;
}

function phase2Multiline(ti, text, targetH, sizePt, thresh) {
  ti.size = new UnitValue(sizePt, "pt");
  ti.autoLeading = false;
  ti.leading = new UnitValue(sizePt * 1.2, "pt");
  var leadingPt = sizePt * 1.2;

  for (var r = 0; r < PHASE2_MAX_ROUNDS; r++) {
    leadingPt = subA(ti, text, targetH, sizePt);
    var h = getLayerH(gLabLayer);
    if (Math.abs(h - targetH) <= thresh) break;
    sizePt = subB(ti, text, targetH, sizePt, leadingPt);
    leadingPt = sizePt * (leadingPt / sizePt); // re-proportioned
    ti.leading = new UnitValue(leadingPt, "pt");
    h = getLayerH(gLabLayer);
    if (Math.abs(h - targetH) <= thresh) break;
  }
  return { sizePt: sizePt, leadingPt: leadingPt };
}

function phase2SingleLine(ti, text, targetH, sizePt, thresh) {
  var loS = sizePt * 0.95, hiS = sizePt * 1.05;
  ti.autoLeading = true;
  for (var r = 0; r < PHASE2_MAX_ROUNDS; r++) {
    for (var j = 0; j < 5; j++) {
      var midS = (loS + hiS) / 2;
      ti.size = new UnitValue(midS, "pt");
      var h = getLayerH(gLabLayer);
      if (h < targetH) loS = midS;
      else hiS = midS;
    }
    sizePt = (loS + hiS) / 2;
    ti.size = new UnitValue(sizePt, "pt");
    if (Math.abs(getLayerH(gLabLayer) - targetH) <= thresh) break;
  }
  return { sizePt: sizePt, leadingPt: null };
}

// ─── Width Precheck ─────────────────────────────────────────────
function widthPrecheck(ti, text, origWPx, sizePt, leadingPt, isMultiline, thresh) {
  var curW = getLayerW(gLabLayer);
  if (curW <= origWPx * 1.3) return { sizePt: sizePt, leadingPt: leadingPt };

  var scale = origWPx / curW;
  sizePt = Math.max(sizePt * 0.8, sizePt * scale);
  ti.size = new UnitValue(sizePt, "pt");
  if (leadingPt !== null) {
    leadingPt = leadingPt * scale;
    ti.leading = new UnitValue(leadingPt, "pt");
  }

  // re-converge with simplified phase2
  var loS = sizePt * 0.9, hiS = sizePt * 1.1;
  for (var r = 0; r < 3; r++) {
    for (var j = 0; j < PHASE2_SUB_ITERS; j++) {
      var midS = (loS + hiS) / 2;
      ti.size = new UnitValue(midS, "pt");
      if (leadingPt !== null) {
        ti.leading = new UnitValue(midS * (leadingPt / sizePt), "pt");
      }
      curW = getLayerW(gLabLayer);
      if (curW > origWPx * 1.3) hiS = midS;
      else loS = midS;
    }
    sizePt = (loS + hiS) / 2;
    if (sizePt <= sizePt * 0.8) break;
  }
  return { sizePt: sizePt, leadingPt: leadingPt };
}

// ─── Phase 3: Tracking ──────────────────────────────────────────
function phase3Tracking(ti, text, targetH, origWPx, sizePt, leadingPt, isMultiline) {
  var tracking = 0;
  try { tracking = ti.tracking; } catch(e) {}

  var TRACK_MIN = -100, TRACK_MAX = 200;
  var converged = false;

  for (var r = 0; r < 5; r++) {
    var loT = Math.max(TRACK_MIN, tracking - 50);
    var hiT = Math.min(TRACK_MAX, tracking + 50);
    for (var j = 0; j < PHASE2_SUB_ITERS; j++) {
      var midT = Math.round((loT + hiT) / 2);
      ti.tracking = midT;
      var w = getLayerW(gLabLayer);
      if (w > origWPx) loT = midT;
      else hiT = midT;
    }
    tracking = Math.round((loT + hiT) / 2);
    ti.tracking = tracking;

    if (getLayerW(gLabLayer) <= origWPx * 1.05) { converged = true; break; }

    // tracking hit floor — shrink size slightly
    if (tracking <= TRACK_MIN + 5) {
      var newSize = sizePt * 0.95;
      if (newSize < sizePt * 0.8) { converged = false; break; }
      sizePt = newSize;
      ti.size = new UnitValue(sizePt, "pt");
      if (leadingPt !== null) {
        leadingPt = leadingPt * (sizePt / (sizePt / 0.95));
        ti.leading = new UnitValue(leadingPt, "pt");
      }
    }
  }
  return { sizePt: sizePt, leadingPt: leadingPt, tracking: tracking, converged: converged };
}

// ─── Main: find adapted params ──────────────────────────────────
function findAdaptedParams(rec, targetPsFont, newText) {
  var origText   = rec.originalText;
  var origSizePt = rec.originalSizePt;
  var origH      = rec.boundsHPx;
  var origW      = rec.boundsWPx;
  var fakesBold  = rec.fakesBold;
  var isMultiline = (origText.indexOf("\\n") !== -1 || newText.indexOf("\\n") !== -1);
  var boxW = Math.max(origW * 2, 800);
  var boxH = Math.max(origH * 3, 800);

  var thresh = convergenceThreshold(origH, fakesBold);

  // Scale calibration: measure original in lab, derive scale factor
  setupLabText(origText, rec.originalFontPs, origSizePt, isMultiline, boxW, boxH);
  var labH = getLayerH(gLabLayer);
  var scale = labH > 0 ? origH / labH : 1.0;
  var targetH = labH > 0 ? origH / scale : origH;

  // Phase 1
  var ti = gLabLayer.textItem;
  ti.font = targetPsFont;
  ti.contents = newText;
  var sizePt = phase1(newText, targetPsFont, targetH, isMultiline, boxW, boxH);
  ti.size = new UnitValue(sizePt, "pt");

  // Phase 2
  var p2;
  if (isMultiline) {
    p2 = phase2Multiline(ti, newText, targetH, sizePt, thresh);
  } else {
    p2 = phase2SingleLine(ti, newText, targetH, sizePt, thresh);
  }
  sizePt = p2.sizePt;
  var leadingPt = p2.leadingPt;

  // Width Precheck
  var wp = widthPrecheck(ti, newText, origW, sizePt, leadingPt, isMultiline, thresh);
  sizePt  = wp.sizePt;
  leadingPt = wp.leadingPt;

  // Phase 3 (tracking)
  var p3 = phase3Tracking(ti, newText, targetH, origW, sizePt, leadingPt, isMultiline);
  sizePt   = p3.sizePt;
  leadingPt = p3.leadingPt;
  var tracking = p3.tracking;

  var converged = (Math.abs(getLayerH(gLabLayer) - targetH) <= thresh * 2);

  return {
    fontPs: targetPsFont,
    sizePt: Math.round(sizePt * 100) / 100,
    leadingPt: leadingPt !== null ? Math.round(leadingPt * 100) / 100 : null,
    tracking: Math.round(tracking),
    converged: converged
  };
}
`
}
