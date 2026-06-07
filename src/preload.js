const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getModelState: () => ipcRenderer.invoke('get-model-state'),
  startDownload: () => ipcRenderer.send('start-download'),
  pauseDownload: () => ipcRenderer.send('pause-download'),
  chat: (messages) => ipcRenderer.invoke('chat', messages),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, data) => cb(data)),
  onDownloadComplete: (cb) => ipcRenderer.on('download-complete', () => cb()),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close')
})
