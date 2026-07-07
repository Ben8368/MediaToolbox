import { WORKSPACE_ROOT } from './state.js'

export class WorkspacePathError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'WorkspacePathError'
  }
}

export function normalizeWorkspacePath(input: string | undefined, workspaceRoot = WORKSPACE_ROOT) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw || raw === '.') return workspaceRoot
  if (/^[a-zA-Z]:($|[\\/])/.test(raw)) throw new WorkspacePathError('路径必须位于工作区内，不能使用磁盘盘符。')
  if (raw.startsWith('\\\\') || raw.startsWith('//')) throw new WorkspacePathError('路径必须位于工作区内，不能使用 UNC 路径。')

  const normalized = raw.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new WorkspacePathError('路径不能包含 . 或 .. 段。')
  }
  if (segments.some((segment) => segment.includes(':'))) {
    throw new WorkspacePathError('路径不能包含盘符或冒号。')
  }

  if (normalized.startsWith('/')) {
    const candidate = `/${segments.join('/')}`
    if (candidate !== workspaceRoot && !candidate.startsWith(`${workspaceRoot}/`)) {
      throw new WorkspacePathError('路径必须位于工作区内。')
    }
    return candidate
  }

  return `${workspaceRoot}/${segments.join('/')}`
}

export function parentWorkspacePath(path: string, workspaceRoot = WORKSPACE_ROOT) {
  const normalized = normalizeWorkspacePath(path, workspaceRoot)
  if (normalized === workspaceRoot) return '/'
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

export async function resolveGrantPath(
  grantId: string,
  db: { pathGrants: { findActiveById(id: string): Promise<{ physicalPath: string; kind: string } | undefined> } },
  expectedKind?: string,
): Promise<string> {
  const grant = await db.pathGrants.findActiveById(grantId)
  if (!grant) throw new WorkspacePathError('路径授权不存在或已过期。')
  if (expectedKind && grant.kind !== expectedKind) {
    throw new WorkspacePathError(`路径授权类型不匹配：期望 ${expectedKind}，实际 ${grant.kind}。`)
  }
  return grant.physicalPath
}
