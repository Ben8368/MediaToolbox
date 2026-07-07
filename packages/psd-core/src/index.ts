import type { PsdRenderInput, PsdTemplateManifest } from '@mediatoolbox/contracts'
export type { PsdRenderInput, PsdTemplateManifest, TemplateSlot, TemplateSlotKind } from '@mediatoolbox/contracts'

export type PsdEngine = {
  inspect(psdPath: string): Promise<PsdTemplateManifest>
  render(template: PsdTemplateManifest, input: PsdRenderInput): Promise<{ outputPath: string }>
}

export type PhotoshopScriptRunner = (script: string) => Promise<string>

export type PhotoshopPsdEngineOptions = {
  runScript: PhotoshopScriptRunner
  outputDirectory?: string
}

export type PhotoshopCommandRunnerOptions = {
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export class PhotoshopPsdEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoshopPsdEngineError'
  }
}

export function createPhotoshopPsdEngine(options: PhotoshopPsdEngineOptions): PsdEngine {
  return {
    async inspect(psdPath: string): Promise<PsdTemplateManifest> {
      const output = await options.runScript(buildPhotoshopInspectScript(psdPath))
      const manifest = parsePhotoshopJson<PsdTemplateManifest>(output)
      return { ...manifest, sourcePath: manifest.sourcePath ?? psdPath }
    },

    async render(template: PsdTemplateManifest, input: PsdRenderInput): Promise<{ outputPath: string }> {
      const sourcePath = template.sourcePath ?? stringInput(input.__psdPath)
      if (!sourcePath) throw new PhotoshopPsdEngineError('PSD render requires template.sourcePath or input.__psdPath.')

      const outputPath = stringInput(input.__outputPath) ?? defaultOutputPath(template, options.outputDirectory)
      await options.runScript(buildPhotoshopRenderScript({ template: { ...template, sourcePath }, input, outputPath }))
      return { outputPath }
    },
  }
}

export function createPhotoshopCommandRunner(options: PhotoshopCommandRunnerOptions): PhotoshopScriptRunner {
  return async (script: string) => {
    const [{ spawn }, fs, os, path] = await Promise.all([
      import('node:child_process'),
      import('node:fs/promises'),
      import('node:os'),
      import('node:path'),
    ])
    const scriptPath = path.join(os.tmpdir(), `mediatoolbox-photoshop-${process.pid}-${Date.now()}.jsx`)
    await fs.writeFile(scriptPath, script, 'utf8')
    try {
      const args = options.args?.length
        ? options.args.map((arg) => (arg === '{script}' ? scriptPath : arg))
        : [scriptPath]
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(options.command, args, {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          windowsHide: true,
        })
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString()
        })
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString()
        })
        child.on('error', reject)
        child.on('exit', (code) => {
          if (code === 0) resolve(stdout || stderr)
          else reject(new PhotoshopPsdEngineError(`Photoshop command failed with exit code ${code}: ${stderr || stdout}`))
        })
      })
    } finally {
      await fs.unlink(scriptPath).catch(() => undefined)
    }
  }
}

export function buildPhotoshopInspectScript(psdPath: string): string {
  return `
var file = new File(${JSON.stringify(psdPath)});
if (!file.exists) throw new Error("PSD file does not exist: " + file.fsName);
var doc = app.open(file);
function layerPath(parentPath, layer) {
  var next = parentPath.slice();
  next.push(layer.name);
  return next;
}
function collectSlots(layers, parentPath, slots) {
  for (var i = 0; i < layers.length; i += 1) {
    var layer = layers[i];
    var path = layerPath(parentPath, layer);
    if (layer.typename === "ArtLayer") {
      var kind = layer.kind === LayerKind.TEXT ? "text" : "image";
      slots.push({ id: path.join("/"), kind: kind, label: layer.name, layerPath: path, required: false });
    } else if (layer.layers) {
      collectSlots(layer.layers, path, slots);
    }
  }
}
var slots = [];
collectSlots(doc.layers, [], slots);
var manifest = {
  id: doc.name.replace(/\\.[^.]+$/, ""),
  name: doc.name,
  version: 1,
  sourcePath: file.fsName,
  document: { width: Number(doc.width.value), height: Number(doc.height.value), resolution: Number(doc.resolution) },
  slots: slots
};
$.writeln("__MTB_JSON__" + JSON.stringify(manifest));
doc.close(SaveOptions.DONOTSAVECHANGES);
`
}

export function buildPhotoshopRenderScript(options: { template: PsdTemplateManifest; input: PsdRenderInput; outputPath: string }): string {
  const textSlots = options.template.slots.filter((slot) => slot.kind === 'text' && options.input[slot.id] !== undefined)
  return `
var doc = app.open(new File(${JSON.stringify(options.template.sourcePath)}));
function findLayer(layers, path, index) {
  for (var i = 0; i < layers.length; i += 1) {
    var layer = layers[i];
    if (layer.name !== path[index]) continue;
    if (index === path.length - 1) return layer;
    if (layer.layers) return findLayer(layer.layers, path, index + 1);
  }
  return null;
}
var replacements = ${JSON.stringify(textSlots.map((slot) => ({ path: slot.layerPath, value: String(options.input[slot.id]) })))};
for (var i = 0; i < replacements.length; i += 1) {
  var item = replacements[i];
  var layer = findLayer(doc.layers, item.path, 0);
  if (!layer || layer.kind !== LayerKind.TEXT) throw new Error("Text layer not found: " + item.path.join("/"));
  layer.textItem.contents = item.value;
}
var output = new File(${JSON.stringify(options.outputPath)});
var pngOptions = new PNGSaveOptions();
doc.saveAs(output, pngOptions, true, Extension.LOWERCASE);
$.writeln("__MTB_JSON__" + JSON.stringify({ outputPath: output.fsName }));
doc.close(SaveOptions.DONOTSAVECHANGES);
`
}

function parsePhotoshopJson<T>(output: string): T {
  const marker = '__MTB_JSON__'
  const markedLine = output.split(/\r?\n/).find((line) => line.includes(marker))
  const raw = markedLine ? markedLine.slice(markedLine.indexOf(marker) + marker.length) : output.trim()
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new PhotoshopPsdEngineError(`Photoshop adapter returned invalid JSON: ${message}`)
  }
}

function stringInput(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function defaultOutputPath(template: PsdTemplateManifest, outputDirectory = '.'): string {
  return `${outputDirectory.replace(/[\\/]$/, '')}/${template.id}-${Date.now()}.png`
}
