import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PsdTemplateManifest } from '@mediatoolbox/psd-core'

import { resolveRenderPayload } from './psd.js'
import { createApiState } from '../state.js'

function baseTemplate(overrides: Partial<PsdTemplateManifest> = {}): PsdTemplateManifest {
  return {
    id: 'promo',
    name: 'promo.psd',
    version: 1,
    sourcePath: '/Workspace/PSD/promo.psd',
    document: { width: 800, height: 600 },
    slots: [{ id: 'title', kind: 'text', label: 'Title', layerPath: ['title'], required: false }],
    ...overrides,
  }
}

describe('resolveRenderPayload', () => {
  it('converts source to physical path and emits a server-controlled output inside the workspace', async () => {
    const state = createApiState()
    const payload = await resolveRenderPayload(state, baseTemplate(), { title: 'Sale' })

    const root = path.resolve(state.physicalWorkspaceRoot)
    expect(payload.template.sourcePath?.startsWith(root)).toBe(true)
    expect(String(payload.input.__outputPath).startsWith(path.join(root, 'Exports'))).toBe(true)
    expect(payload.virtualOutput.startsWith(`${state.workspaceRoot}/Exports/`)).toBe(true)
    expect(payload.input.title).toBe('Sale')
  })

  it('strips client-provided __outputPath so it cannot escape the workspace', async () => {
    const state = createApiState()
    const payload = await resolveRenderPayload(state, baseTemplate(), {
      title: 'Sale',
      __outputPath: 'C:/Windows/evil.png',
    })

    const root = path.resolve(state.physicalWorkspaceRoot)
    expect(String(payload.input.__outputPath).startsWith(root)).toBe(true)
    expect(payload.input.__outputPath).not.toBe('C:/Windows/evil.png')
  })

  it('strips client-provided __psdPath so it cannot override the workspace source', async () => {
    const state = createApiState()
    const payload = await resolveRenderPayload(state, baseTemplate(), {
      title: 'Sale',
      __psdPath: 'C:/secrets/other.psd',
    })

    expect(payload.input.__psdPath).toBeUndefined()
  })

  it('rejects a source path that escapes the workspace root', async () => {
    const state = createApiState()
    await expect(
      resolveRenderPayload(state, baseTemplate({ sourcePath: '/Workspace/../../etc/passwd.psd' }), { title: 'x' }),
    ).rejects.toThrow()
  })

  it('rejects a source path using a drive letter', async () => {
    const state = createApiState()
    await expect(
      resolveRenderPayload(state, baseTemplate({ sourcePath: 'C:/Windows/win.psd' }), { title: 'x' }),
    ).rejects.toThrow()
  })

  it('requires template.sourcePath', async () => {
    const state = createApiState()
    const template = baseTemplate()
    delete template.sourcePath
    await expect(resolveRenderPayload(state, template, { title: 'x' })).rejects.toThrow(/sourcePath/)
  })

  it('rejects required non-text slots before invoking the worker engine', async () => {
    const state = createApiState()
    await expect(
      resolveRenderPayload(state, baseTemplate({
        slots: [
          { id: 'title', kind: 'text', label: 'Title', layerPath: ['title'], required: false },
          { id: 'hero', kind: 'smart-object', label: 'Hero', layerPath: ['hero'], required: true },
        ],
      }), { title: 'x' }),
    ).rejects.toThrow(/text slots only/)
  })
})
