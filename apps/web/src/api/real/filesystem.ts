import { apiRequest } from '@/api/http'
import type { TrashEntry } from '@/apps/file-manager/types'

export async function getWorkspace() {
  return apiRequest<{
    ok: boolean
    project_root?: string
    workspace?: { project_root?: string; downloads?: string; exports?: string }
  }>('/api/filebrowser/workspace')
}

export async function fetchFilebrowserDisks() {
  return apiRequest<{
    ok: boolean
    disks?: Array<{ name: string; path: string; total: number; used: number; free: number }>
  }>('/api/filebrowser/disks')
}

export async function listFilebrowserDirectory(payload: { directory: string }) {
  return apiRequest<Record<string, unknown>>('/api/filebrowser/list', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createFilebrowserDirectory(path: string) {
  return apiRequest<{ ok: boolean; path?: string }>('/api/filebrowser/mkdir', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

export async function deleteFilebrowserPath(path: string, toTrash = true) {
  return apiRequest<{ ok: boolean; message?: string }>('/api/filebrowser/path', {
    method: 'DELETE',
    body: JSON.stringify({ path, to_trash: toTrash }),
  })
}

export async function fetchFilebrowserTrash() {
  return apiRequest<{ ok: boolean; items?: TrashEntry[] }>('/api/filebrowser/trash')
}

export async function restoreFilebrowserTrash(id: string) {
  return apiRequest<{ ok: boolean; message?: string }>(`/api/filebrowser/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  })
}

export async function purgeFilebrowserTrash(id: string) {
  return apiRequest<{ ok: boolean; message?: string }>(`/api/filebrowser/trash/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function emptyFilebrowserTrash() {
  return apiRequest<{ ok: boolean }>('/api/filebrowser/trash', {
    method: 'DELETE',
  })
}

export async function setWorkspace(workspace: string) {
  return apiRequest<{ ok: boolean; workspace?: string }>('/api/filebrowser/workspace', {
    method: 'PUT',
    body: JSON.stringify({ workspace }),
  })
}
