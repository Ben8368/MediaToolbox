import { create } from 'zustand'

interface SystemStore {
  showLauncher: boolean
  themeMode: 'light' | 'dark'
  wallpaper: number
  systemLifecycle: 'running' | 'shutting-down' | 'shutdown-complete'
  setShowLauncher: (show: boolean) => void
  toggleLauncher: () => void
  setThemeMode: (mode: 'light' | 'dark') => void
  setWallpaper: (idx: number) => void
  beginSystemShutdown: () => void
  completeSystemShutdown: () => void
  resetSystemLifecycle: () => void
}

export const useSystemStore = create<SystemStore>()((set, get) => ({
  showLauncher: false,
  themeMode: 'dark',
  wallpaper: 2,
  systemLifecycle: 'running',
  setShowLauncher: (show) => set({ showLauncher: show }),
  toggleLauncher: () => set((s) => ({ showLauncher: !s.showLauncher })),
  setThemeMode: (themeMode) => set({ themeMode }),
  setWallpaper: (wallpaper) => set({ wallpaper }),
  beginSystemShutdown: () => set({ systemLifecycle: 'shutting-down' }),
  completeSystemShutdown: () => set({ systemLifecycle: 'shutdown-complete' }),
  resetSystemLifecycle: () => set({ systemLifecycle: 'running' }),
}))
