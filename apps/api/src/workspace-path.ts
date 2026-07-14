import { WORKSPACE_ROOT, type ApiState } from './state.js'
import { toPhysicalWorkspacePath } from './workspace-files.js'

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

/**
 * 把一个读授权绑定到正在创建的 job；job 结束生命周期时可据此吊销。
 * 只在真正创建任务时调用，不要在 probe/preview 等只读预览路径调用。
 */
export async function bindReadGrantToJob(state: ApiState, grantId: string, jobId: string): Promise<void> {
  await state.db.pathGrants.bindJob(grantId, jobId, Date.now())
}

/** 吊销绑定到某个 job 的所有活跃 grant；在 job 进入终态（succeeded/failed/canceled）时调用。 */
export async function revokeGrantsBoundToJob(state: ApiState, jobId: string): Promise<void> {
  const grants = await state.db.pathGrants.findActiveByJobId(jobId)
  await Promise.all(grants.map((grant) => state.db.pathGrants.update({ id: grant.id, status: 'revoked', updatedAt: Date.now() })))
}

/** 写授权默认 one-shot：真正用于落盘写入后立即消费，不允许重复使用同一个 grant。 */
async function consumeWriteGrant(state: ApiState, grantId: string): Promise<void> {
  await state.db.pathGrants.update({ id: grantId, status: 'consumed', updatedAt: Date.now() })
}

const GRANT_MARKER_PREFIX = '__grant:'

/**
 * 需要把"输入来自哪个 grant"持久化到虚拟路径字段时（如 WorkOrder.psdPath），
 * 用这个不透明标记代替物理路径或误导性占位字符串，避免下次解析时把标记当工作区路径处理。
 */
export function toGrantMarker(grantId: string): string {
  return `${GRANT_MARKER_PREFIX}${grantId}`
}

export function grantIdFromMarker(marker: string): string | undefined {
  return marker.startsWith(GRANT_MARKER_PREFIX) ? marker.slice(GRANT_MARKER_PREFIX.length) : undefined
}

/**
 * 解析一个可能是 grant 标记、也可能是工作区虚拟路径的字符串。
 * 用于重新打开此前用 grant 扫描/生成的记录（如 PSD WorkOrder.psdPath）。
 */
export async function resolvePathOrGrantMarker(
  state: ApiState,
  pathOrMarker: string,
  expectedKind: string,
): Promise<string> {
  const grantId = grantIdFromMarker(pathOrMarker)
  if (grantId) return resolveGrantPath(grantId, state.db, expectedKind)
  const virtualPath = normalizeWorkspacePath(pathOrMarker, state.workspaceRoot)
  return toPhysicalWorkspacePath(state, virtualPath)
}

export type ResolvedPath = {
  /** 供第三方工具（ffmpeg/Photoshop 等）直接使用的物理路径。 */
  physicalPath: string
  /** 落在工作区内时的虚拟路径；来自 grant 的外部路径没有对应虚拟路径。 */
  virtualPath?: string
}

/**
 * 统一"传 grantId 走授权、否则走工作区虚拟路径"的解析逻辑，
 * 返回的 physicalPath 始终可直接交给文件系统 / 第三方工具使用。
 */
export async function resolveInputPath(
  state: ApiState,
  input: { path?: string | undefined; grantId?: string | undefined; bindJobId?: string | undefined },
): Promise<ResolvedPath> {
  if (input.grantId) {
    const physicalPath = await resolveGrantPath(input.grantId, state.db, 'file.read')
    if (input.bindJobId) await bindReadGrantToJob(state, input.grantId, input.bindJobId)
    return { physicalPath }
  }
  const virtualPath = normalizeWorkspacePath(input.path, state.workspaceRoot)
  return { physicalPath: toPhysicalWorkspacePath(state, virtualPath), virtualPath }
}

export async function resolveOutputPath(
  state: ApiState,
  input: {
    path?: string | undefined
    grantId?: string | undefined
    requireExportsDir?: boolean | undefined
    exportsErrorMessage?: string | undefined
    /** 传 true 时立即消费该写授权（one-shot）。仅在真正要落盘写入时才传 true，probe/preview 等只读路径不要传。 */
    consumeGrant?: boolean | undefined
  },
): Promise<ResolvedPath> {
  if (input.grantId) {
    const physicalPath = await resolveGrantPath(input.grantId, state.db, 'file.write')
    if (input.consumeGrant) await consumeWriteGrant(state, input.grantId)
    return { physicalPath }
  }
  const virtualPath = normalizeWorkspacePath(input.path, state.workspaceRoot)
  if (input.requireExportsDir) {
    const exportsRoot = `${state.workspaceRoot}/Exports`
    if (virtualPath === exportsRoot || !virtualPath.startsWith(`${exportsRoot}/`)) {
      throw new WorkspacePathError(input.exportsErrorMessage ?? '输出路径必须位于工作区 Exports 目录内。')
    }
  }
  return { physicalPath: toPhysicalWorkspacePath(state, virtualPath), virtualPath }
}
