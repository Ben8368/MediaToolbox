export type TemplateSlotKind = 'text' | 'image' | 'smart-object' | 'shape' | 'canvas'

export type TemplateSlot = {
  id: string
  kind: TemplateSlotKind
  label: string
  layerPath: string[]
  required: boolean
}

export type PsdTemplateManifest = {
  id: string
  name: string
  version: number
  document: {
    width: number
    height: number
    resolution?: number
  }
  slots: TemplateSlot[]
}

export type PsdRenderInput = Record<string, string | number | boolean>

export type PsdEngine = {
  inspect(psdPath: string): Promise<PsdTemplateManifest>
  render(template: PsdTemplateManifest, input: PsdRenderInput): Promise<{ outputPath: string }>
}
