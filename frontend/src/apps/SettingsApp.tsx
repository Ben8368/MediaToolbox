import { useEffect, useState } from 'react'

import { getApiRuntimePresentation } from '@/api/runtime'
import { useSystemStore } from '@/store'

type LiteSettings = {
  workspacePath: string
  accent: string
  compactMode: boolean
}

const STORAGE_KEY = 'mediatools.frontendLite.settings'

const DEFAULT_SETTINGS: LiteSettings = {
  workspacePath: '/Workspace',
  accent: '#2f7dff',
  compactMode: true,
}

function readSettings(): LiteSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function SettingsApp() {
  const runtime = getApiRuntimePresentation()
  const { themeMode, setThemeMode, wallpaper, setWallpaper } = useSystemStore()
  const [settings, setSettings] = useState<LiteSettings>(() => readSettings())
  const [notice, setNotice] = useState(runtime.settings.initialNotice)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    const id = window.setTimeout(() => setNotice('设置已保存到 localStorage'), 120)
    return () => window.clearTimeout(id)
  }, [settings])

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <nav className="settings-nav">
          <button type="button" className="settings-nav-item settings-nav-item--active">
            <SettingsIcon />
            <span>外观</span>
          </button>
          <button type="button" className="settings-nav-item" onClick={() => setNotice(runtime.settings.accountNotice)}>
            <UserIcon />
            <span>账户</span>
          </button>
          <button type="button" className="settings-nav-item" onClick={() => setNotice(runtime.settings.serviceNotice)}>
            <ServiceIcon />
            <span>服务</span>
          </button>
        </nav>
      </aside>

      <main className="settings-panel">
        <div className="settings-toolbar">
          <div>
            <h2>系统设置</h2>
            <p>{runtime.settings.toolbarDescription}</p>
          </div>
          <div className="settings-badge">{runtime.serviceBadge}</div>
        </div>

        <div className="settings-content">
          <section className="settings-card">
            <h3>外观</h3>
            <div className="settings-grid">
              <label className="settings-field">
                <span>主题</span>
                <select value={themeMode} onChange={(event) => setThemeMode(event.target.value as 'light' | 'dark')}>
                  <option value="dark">深色</option>
                  <option value="light">浅色预览</option>
                </select>
              </label>
              <label className="settings-field">
                <span>强调色</span>
                <input
                  value={settings.accent}
                  onChange={(event) => setSettings((current) => ({ ...current, accent: event.target.value }))}
                />
              </label>
            </div>
            <div className="settings-wallpapers">
              {Array.from({ length: 6 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`settings-wallpaper ${wallpaper === index ? 'settings-wallpaper--active' : ''}`}
                  style={{ backgroundImage: `url('/static/bg/live/wallpaper-${index + 1}-dark.webp')` }}
                  title={`壁纸 ${index + 1}`}
                  onClick={() => setWallpaper(index)}
                />
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h3>工作区</h3>
            <div className="settings-grid">
              <label className="settings-field">
                <span>工作区路径</span>
                <input
                  value={settings.workspacePath}
                  onChange={(event) => setSettings((current) => ({ ...current, workspacePath: event.target.value }))}
                />
              </label>
              <label className="settings-field">
                <span>桌面布局</span>
                <select
                  value={settings.compactMode ? 'compact' : 'comfortable'}
                  onChange={(event) => setSettings((current) => ({ ...current, compactMode: event.target.value === 'compact' }))}
                >
                  <option value="compact">紧凑</option>
                  <option value="comfortable">舒展</option>
                </select>
              </label>
            </div>
            <p>{runtime.settings.workspaceDescription}</p>
          </section>

          <section className="settings-card">
            <h3>{runtime.settings.behaviorTitle}</h3>
            <p>{notice}</p>
            <div className="settings-actions">
              <button type="button" className="mt-btn" onClick={() => setNotice(runtime.settings.updateNotice)}>
                检查更新
              </button>
              <button type="button" className="mt-btn" onClick={() => setNotice(runtime.settings.connectionNotice)}>
                测试连接
              </button>
              <button
                type="button"
                className="mt-btn mt-btn--primary"
                onClick={() => {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
                  setNotice('设置已保存到 localStorage')
                }}
              >
                保存设置
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

const SettingsIcon = () => <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3 1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8 1.7 1.7 0 001.5 1h.1a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
const UserIcon = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" /></svg>
const ServiceIcon = () => <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /><path d="M8 7v10M16 7v10" /></svg>
