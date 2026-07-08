import { createReadStream, type ReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ApiState } from './state.js'

export function toPhysicalWorkspacePath(state: ApiState, virtualPath: string): string {
  const relative = virtualPath === state.workspaceRoot ? '' : virtualPath.slice(state.workspaceRoot.length + 1)
  const resolved = path.resolve(state.physicalWorkspaceRoot, ...relative.split('/').filter(Boolean))
  const root = path.resolve(state.physicalWorkspaceRoot)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Physical path escaped workspace root.')
  }
  return resolved
}

export function toVirtualWorkspacePath(state: ApiState, physicalPath: string): string {
  const resolved = path.resolve(physicalPath)
  const root = path.resolve(state.physicalWorkspaceRoot)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Physical path escaped workspace root.')
  }
  const relative = path.relative(root, resolved).split(path.sep).filter(Boolean).join('/')
  return relative ? `${state.workspaceRoot}/${relative}` : state.workspaceRoot
}

export async function readWorkspaceFileForDownload(state: ApiState, virtualPath: string): Promise<{ stream: ReadStream; filename: string; size: number }> {
  const physicalPath = toPhysicalWorkspacePath(state, virtualPath)
  const stat = await fs.stat(physicalPath).catch(() => undefined)
  if (!stat?.isFile()) {
    const error = new Error('下载文件不存在或尚未生成。')
    ;(error as Error & { statusCode?: number }).statusCode = 404
    throw error
  }
  return {
    stream: createReadStream(physicalPath),
    filename: path.basename(physicalPath),
    size: stat.size,
  }
}
