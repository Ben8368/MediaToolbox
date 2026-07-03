import type { PsdTemplateManifest } from '@mediatoolbox/psd-core'

export function describePsdWorker(manifest: PsdTemplateManifest) {
  return {
    name: 'psd-worker',
    templateId: manifest.id,
    slotCount: manifest.slots.length,
  }
}
