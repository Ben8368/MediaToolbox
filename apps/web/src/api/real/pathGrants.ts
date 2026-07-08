import { apiRequest, ApiRequestError } from '@/api/http'
import type { DesktopBrowserResult } from '@/desktopBrowser'
import type { PathGrantInfo, PathGrantKind, PathGrantResponse } from '@mediatoolbox/contracts'

export async function requestReadGrant(): Promise<PathGrantInfo | null> {
  return unwrapDesktopGrant(await window.mediaToolboxDesktop?.pathGrants?.requestRead())
}

export async function requestWriteGrant(defaultPath?: string): Promise<PathGrantInfo | null> {
  return unwrapDesktopGrant(await window.mediaToolboxDesktop?.pathGrants?.requestWrite(defaultPath))
}

export async function requestDirReadGrant(): Promise<PathGrantInfo | null> {
  return unwrapDesktopGrant(await window.mediaToolboxDesktop?.pathGrants?.requestDirRead())
}

export async function getPathGrant(id: string): Promise<PathGrantInfo | null> {
  try {
    const result = await apiRequest<PathGrantResponse>(`/api/path-grants/${encodeURIComponent(id)}`)
    return result.grant ?? null
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

function unwrapDesktopGrant(result: DesktopBrowserResult<PathGrantInfo | null> | undefined): PathGrantInfo | null {
  return result?.ok ? result.data : null
}

export type { PathGrantInfo, PathGrantKind }
