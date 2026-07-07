import { apiRequest, ApiRequestError } from '@/api/http'

type PathGrantKind = 'file.read' | 'file.write' | 'dir.read'

type PathGrantInfo = {
  id: string
  kind: PathGrantKind
  status: string
  displayName: string
  expiresAt: number
  createdAt: number
  updatedAt: number
  jobId?: string
}

export async function requestReadGrant(): Promise<PathGrantInfo | null> {
  return (window as any).electron?.ipcRenderer?.invoke('mediatoolbox:path-grant:request-read') ?? null
}

export async function requestWriteGrant(defaultPath?: string): Promise<PathGrantInfo | null> {
  return (window as any).electron?.ipcRenderer?.invoke('mediatoolbox:path-grant:request-write', { defaultPath }) ?? null
}

export async function requestDirReadGrant(): Promise<PathGrantInfo | null> {
  return (window as any).electron?.ipcRenderer?.invoke('mediatoolbox:path-grant:request-dir-read') ?? null
}

export async function getPathGrant(id: string): Promise<PathGrantInfo | null> {
  try {
    return await apiRequest<PathGrantInfo>(`/api/path-grants/${encodeURIComponent(id)}`)
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null
    throw err
  }
}

export async function revokePathGrant(id: string): Promise<boolean> {
  const result = await apiRequest<{ ok: boolean }>(`/api/path-grants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  return result?.ok ?? false
}
