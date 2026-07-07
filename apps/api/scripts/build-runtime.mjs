import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(apiRoot, 'dist')

await rm(distDir, { recursive: true, force: true })

await build({
  entryPoints: [path.join(apiRoot, 'src', 'server.ts')],
  outfile: path.join(distDir, 'server.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['better-sqlite3'],
})
