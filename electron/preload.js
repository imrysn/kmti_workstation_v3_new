const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileIcon: (filePath, isFolder) => ipcRenderer.invoke('get-file-icon', filePath, isFolder),
  loginSuccess: () => ipcRenderer.invoke('login-success'),
  logoutReset: () => ipcRenderer.invoke('logout-reset'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  getWorkstationInfo: () => ipcRenderer.invoke('get-workstation-info'),

  // --- Auto Updater ---
  // Renderer → Main
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installAndRestart: () => ipcRenderer.invoke('install-and-restart'),

  // Main → Renderer (push events)
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-download-progress', (_, progress) => cb(progress)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_, msg) => cb(msg)),

  // Cleanup
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-not-available')
    ipcRenderer.removeAllListeners('update-downloaded')
    ipcRenderer.removeAllListeners('update-download-progress')
    ipcRenderer.removeAllListeners('update-error')
  },
})
