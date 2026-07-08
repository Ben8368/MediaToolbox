export function buildFontListScript(): string {
  return `
var fonts = [];
for (var i = 0; i < app.fonts.length; i++) {
  var f = app.fonts[i];
  fonts.push({
    postScriptName: f.postScriptName,
    family: f.family,
    style: f.style
  });
}
$.writeln("__MTB_JSON__" + JSON.stringify({ ok: true, fonts: fonts }));
`
}

export type FontListOutput = {
  ok: boolean
  fonts?: Array<{ postScriptName: string; family: string; style: string }>
  message?: string
}

export function parseFontListOutput(output: string): FontListOutput {
  const marker = '__MTB_JSON__'
  const markedLine = output.split(/\r?\n/).find((line) => line.includes(marker))
  const raw = markedLine ? markedLine.slice(markedLine.indexOf(marker) + marker.length) : output.trim()
  try {
    return JSON.parse(raw) as FontListOutput
  } catch {
    return { ok: false, message: `Failed to parse font list output: ${raw.slice(0, 200)}` }
  }
}
