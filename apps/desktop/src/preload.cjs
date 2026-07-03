const { contextBridge, ipcRenderer } = require('electron')

const browserApi = {
  create(id, url) {
    return ipcRenderer.invoke('mediatoolbox:browser:create', { id, url })
  },
  destroy(id) {
    return ipcRenderer.invoke('mediatoolbox:browser:destroy', { id })
  },
  setBounds(id, bounds, visible) {
    return ipcRenderer.invoke('mediatoolbox:browser:set-bounds', { id, bounds, visible })
  },
  navigate(id, url) {
    return ipcRenderer.invoke('mediatoolbox:browser:navigate', { id, url })
  },
  goBack(id) {
    return ipcRenderer.invoke('mediatoolbox:browser:go-back', { id })
  },
  goForward(id) {
    return ipcRenderer.invoke('mediatoolbox:browser:go-forward', { id })
  },
  reload(id) {
    return ipcRenderer.invoke('mediatoolbox:browser:reload', { id })
  },
  focus(id) {
    return ipcRenderer.invoke('mediatoolbox:browser:focus', { id })
  },
  onEvent(listener) {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('mediatoolbox:browser:event', wrapped)
    return () => ipcRenderer.removeListener('mediatoolbox:browser:event', wrapped)
  },
}

contextBridge.exposeInMainWorld('mediaToolboxDesktop', {
  browser: browserApi,
})
