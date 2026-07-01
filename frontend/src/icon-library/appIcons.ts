const BASE = '/static/app/icons/default'

export const APP_ICON_PATHS = {
  fetcher:     `${BASE}/download-center.png`,
  fileManager: `${BASE}/file-manager.png`,
  'file-manager': `${BASE}/file-manager.png`,
  settings:    `${BASE}/setting.png`,
  logs:        `${BASE}/log-center.png`,
} as const

export type AppId = keyof typeof APP_ICON_PATHS

export const FALLBACK_ICON = `${BASE}/setting.png`

export function getAppIcon(appId: string): string {
  return (APP_ICON_PATHS as Record<string, string>)[appId] ?? FALLBACK_ICON
}
