import { create } from 'zustand'

export type LogViewerPanel = 'notifications' | 'logs'

interface LogViewerStore {
  activePanel: LogViewerPanel
  setActivePanel: (panel: LogViewerPanel) => void
  openNotifications: () => void
  openLogs: () => void
}

export const useLogViewerStore = create<LogViewerStore>((set) => ({
  activePanel: 'logs',
  setActivePanel: (panel) => set({ activePanel: panel }),
  openNotifications: () => set({ activePanel: 'notifications' }),
  openLogs: () => set({ activePanel: 'logs' }),
}))
