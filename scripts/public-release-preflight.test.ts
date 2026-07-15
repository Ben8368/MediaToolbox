import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { runPublicReleasePreflight } from './public-release-preflight.mjs'

const silentLogger = { log: () => undefined, error: () => undefined }

async function createFixture() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-public-release-'))
  const assetDir = path.join(rootDir, 'assets', 'web-composer')
  await fs.mkdir(assetDir, { recursive: true })
  await fs.writeFile(
    path.join(assetDir, 'manifest.json'),
    JSON.stringify({ files: [{ path: 'example.mp4' }] }),
    'utf8',
  )
  return { rootDir, assetDir }
}

describe('public release preflight', () => {
  it('blocks public distribution when license and provenance evidence are missing', async () => {
    const { rootDir } = await createFixture()
    const result = runPublicReleasePreflight({ rootDir, logger: silentLogger })

    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('LICENSE'),
      expect.stringContaining('PROVENANCE.json'),
    ]))
  })

  it('accepts a complete per-file redistribution record', async () => {
    const { rootDir, assetDir } = await createFixture()
    await fs.writeFile(path.join(rootDir, 'LICENSE'), 'Example project license', 'utf8')
    await fs.writeFile(
      path.join(assetDir, 'PROVENANCE.json'),
      JSON.stringify({
        files: [{
          path: 'example.mp4',
          source: 'https://example.com/source',
          copyrightOwner: 'Example Owner',
          license: 'Example redistributable license',
          redistributionEvidence: 'https://example.com/evidence',
        }],
      }),
      'utf8',
    )

    const result = runPublicReleasePreflight({ rootDir, logger: silentLogger })
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
  })

  it('rejects incomplete or out-of-manifest provenance entries', async () => {
    const { rootDir, assetDir } = await createFixture()
    await fs.writeFile(path.join(rootDir, 'LICENSE'), 'Example project license', 'utf8')
    await fs.writeFile(
      path.join(assetDir, 'PROVENANCE.json'),
      JSON.stringify({ files: [{ path: 'other.mp4', source: 'local' }] }),
      'utf8',
    )

    const result = runPublicReleasePreflight({ rootDir, logger: silentLogger })
    expect(result.ok).toBe(false)
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('\u7f3a\u5c11 copyrightOwner'),
      expect.stringContaining('\u672a\u8986\u76d6\u7d20\u6750\uff1aexample.mp4'),
      expect.stringContaining('\u6e05\u5355\u5916\u7d20\u6750\uff1aother.mp4'),
    ]))
  })
})
