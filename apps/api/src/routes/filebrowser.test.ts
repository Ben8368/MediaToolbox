import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { describe, expect, it } from 'vitest'

import { buildApiServer } from '../app.js'

function multipartUploadBody(boundary: string, file: Buffer) {
  return Buffer.concat([
    Buffer.from([
      `--${boundary}`,
      'Content-Disposition: form-data; name="directory"',
      '',
      '/Workspace',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="logo.png"',
      'Content-Type: image/png',
      '',
      '',
    ].join('\r\n')),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
}

describe('file browser upload and download', () => {
  it('uploads PNG bytes through multipart and downloads the same workspace file', async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mtb-filebrowser-upload-'))
    const previousWorkspaceDir = process.env.MEDIATOOLBOX_WORKSPACE_DIR
    process.env.MEDIATOOLBOX_WORKSPACE_DIR = workspaceDir
    let app: FastifyInstance | undefined

    try {
      app = await buildApiServer()
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      )
      const boundary = '----MediaToolboxMultipartBoundary'
      const body = multipartUploadBody(boundary, png)

      const upload = await app.inject({
        method: 'POST',
        url: '/api/filebrowser/upload',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(body.length),
        },
        payload: body,
      })

      expect(upload.statusCode).toBe(200)
      expect(upload.json()).toMatchObject({
        ok: true,
        path: '/Workspace/logo.png',
        name: 'logo.png',
      })

      const download = await app.inject({
        method: 'GET',
        url: '/api/filebrowser/file?path=%2FWorkspace%2Flogo.png',
      })

      expect(download.statusCode).toBe(200)
      expect(download.headers['content-length']).toBe(String(png.length))
      expect(download.rawPayload).toEqual(png)
    } finally {
      if (app) await app.close()
      if (previousWorkspaceDir === undefined) delete process.env.MEDIATOOLBOX_WORKSPACE_DIR
      else process.env.MEDIATOOLBOX_WORKSPACE_DIR = previousWorkspaceDir
      await fs.rm(workspaceDir, { recursive: true, force: true })
    }
  })
})
