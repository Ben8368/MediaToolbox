import { apiRequest, apiUrl } from '@/api/http'
import type {
  CreateDirectoryResponse,
  DirectoryListResponse,
  DiskListResponse,
  OkResult,
  SetWorkspaceResponse,
  TrashListResponse,
  WorkspaceResponse,
} from '@mediatoolbox/contracts'

export async function getWorkspace() {
  return apiRequest<WorkspaceResponse>('/api/filebrowser/workspace')
}

export async function fetchFilebrowserDisks() {
  return apiRequest<DiskListResponse>('/api/filebrowser/disks')
}

export async function listFilebrowserDirectory(payload: { directory: string }) {
  return apiRequest<DirectoryListResponse>('/api/filebrowser/list', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createFilebrowserDirectory(path: string) {
  return apiRequest<CreateDirectoryResponse>('/api/filebrowser/mkdir', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

export async function deleteFilebrowserPath(path: string, toTrash = true) {
  return apiRequest<OkResult>('/api/filebrowser/path', {
    method: 'DELETE',
    body: JSON.stringify({ path, to_trash: toTrash }),
  })
}

export async function fetchFilebrowserTrash() {
  return apiRequest<TrashListResponse>('/api/filebrowser/trash')
}

export async function restoreFilebrowserTrash(id: string) {
  return apiRequest<OkResult>(`/api/filebrowser/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  })
}

export async function purgeFilebrowserTrash(id: string) {
  return apiRequest<OkResult>(`/api/filebrowser/trash/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function emptyFilebrowserTrash() {
  return apiRequest<OkResult>('/api/filebrowser/trash', {
    method: 'DELETE',
  })
}

export async function setWorkspace(workspace: string) {
  return apiRequest<SetWorkspaceResponse>('/api/filebrowser/workspace', {
    method: 'PUT',
    body: JSON.stringify({ workspace }),
  })
}

export async function uploadFilebrowserFile(directory: string, file: File) {
  const form = new FormData()
  form.append('directory', directory)
  form.append('file', file)
  return apiRequest<OkResult & { path?: string; name?: string }>('/api/filebrowser/upload', {
    method: 'POST',
    body: form,
    timeoutMs: 120_000,
  })
}

export function filebrowserFileDownloadUrl(virtualPath: string): string {
  return apiUrl(`/api/filebrowser/file?path=${encodeURIComponent(virtualPath)}`)
}
