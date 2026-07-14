const { contextBridge, ipcRenderer } = require('electron')

const browserApi = {
  create(id, url, options) {
    return ipcRenderer.invoke('mediatoolbox:browser:create', { id, url, sessionScope: options && options.sessionScope })
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
  downloadUrl(id, url) {
    return ipcRenderer.invoke('mediatoolbox:browser:download-url', { id, url })
  },
  request(id, draft) {
    return ipcRenderer.invoke('mediatoolbox:browser:request', { id, ...draft })
  },
  cancelDownload(id, downloadId) {
    return ipcRenderer.invoke('mediatoolbox:browser:cancel-download', { viewId: id, downloadId })
  },
  selectUploadFile(id) {
    return ipcRenderer.invoke('mediatoolbox:browser:select-upload-file', { id })
  },
  onEvent(listener) {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('mediatoolbox:browser:event', wrapped)
    return () => ipcRenderer.removeListener('mediatoolbox:browser:event', wrapped)
  },
}

const pathGrantsApi = {
  requestRead() {
    return ipcRenderer.invoke('mediatoolbox:path-grant:request-read')
  },
  requestWrite(defaultPath) {
    return ipcRenderer.invoke('mediatoolbox:path-grant:request-write', { defaultPath })
  },
  requestDirRead() {
    return ipcRenderer.invoke('mediatoolbox:path-grant:request-dir-read')
  },
}

const systemApi = {
  shutdown() {
    return ipcRenderer.invoke('mediatoolbox:shutdown')
  },
}

contextBridge.exposeInMainWorld('mediaToolboxDesktop', {
  browser: browserApi,
  pathGrants: pathGrantsApi,
  system: systemApi,
})
