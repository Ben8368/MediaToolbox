import type { ComponentType } from 'react'

import { BrowserApp } from '@/apps/BrowserApp'
import { DownloaderApp } from '@/apps/DownloaderApp'
import { FileManagerApp } from '@/apps/FileManagerApp'
import { PsdApp } from '@/apps/PsdApp'
import { SettingsApp } from '@/apps/SettingsApp'
import { TranscodeApp } from '@/apps/TranscodeApp'
import { LogViewer } from '@/LogViewer'
import { APP_ICON_PATHS } from '@/icon-library'

export type RegisteredApp = {
  id: string
  title: string
  label: string
  icon: string
  component: ComponentType
  status: 'stable' | 'beta' | 'hidden'
  launcherVisible?: boolean
}

export const appRegistry: RegisteredApp[] = [
  { id: 'browser', label: 'Scry浏览器', title: 'Scry浏览器', icon: APP_ICON_PATHS.browser, component: BrowserApp, status: 'beta' },
  { id: 'file-manager', label: '文件管理', title: '文件管理', icon: APP_ICON_PATHS.fileManager, component: FileManagerApp, status: 'stable' },
  { id: 'fetcher', label: '下载', title: '下载', icon: APP_ICON_PATHS.fetcher, component: DownloaderApp, status: 'stable' },
  { id: 'transcode', label: '转码', title: '转码', icon: APP_ICON_PATHS.transcode, component: TranscodeApp, status: 'hidden', launcherVisible: false },
  { id: 'ps', label: 'PS', title: 'PS', icon: APP_ICON_PATHS.ps, component: PsdApp, status: 'beta' },
  { id: 'settings', label: '设置', title: '设置', icon: APP_ICON_PATHS.settings, component: SettingsApp, status: 'beta', launcherVisible: false },
  { id: 'logs', label: '日志', title: '日志', icon: APP_ICON_PATHS.logs, component: LogViewer, status: 'hidden', launcherVisible: false },
]

const appRegistryById = new Map(appRegistry.map((app) => [app.id, app]))

export function getRegisteredApp(appId: string): RegisteredApp | undefined {
  return appRegistryById.get(appId)
}

export function getAppMetadata(appId: string): Pick<RegisteredApp, 'id' | 'title' | 'label' | 'icon'> | undefined {
  const app = getRegisteredApp(appId)
  if (!app) return undefined
  return {
    id: app.id,
    title: app.title,
    label: app.label,
    icon: app.icon,
  }
}

export function getLauncherApps(): RegisteredApp[] {
  return appRegistry.filter((app) => app.launcherVisible !== false && (app.status === 'stable' || app.status === 'beta'))
}
