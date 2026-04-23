const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  onWindowMaximized: (cb) => ipcRenderer.on('window-maximized', (_, isMax) => cb(isMax)),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFileIcon: (filePath, isFolder) => ipcRenderer.invoke('get-file-icon', filePath, isFolder),
  loginSuccess: () => ipcRenderer.invoke('login-success'),
  logoutReset: () => ipcRenderer.invoke('logout-reset'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  getWorkstationInfo: () => ipcRenderer.invoke('get-workstation-info'),
  flashWindow: (shouldFlash) => ipcRenderer.invoke('flash-window', shouldFlash),

  // --- Auto Updater ---
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installAndRestart: () => ipcRenderer.invoke('install-and-restart'),

  // --- Stopwatch ---
  getStopwatchRecords: () => ipcRenderer.invoke('get-stopwatch-records'),
  saveStopwatchRecords: (records) => ipcRenderer.invoke('save-stopwatch-records', records),
  openStopwatchFolder: () => ipcRenderer.invoke('open-stopwatch-folder'),

  // Main → Renderer (push events)
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-download-progress', (_, progress) => cb(progress)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_, msg) => cb(msg)),

  // --- System / File Operations ---
  print: (options) => ipcRenderer.invoke('print-window', options),
  printToPDF: (options) => ipcRenderer.invoke('print-to-pdf', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),

  // Cleanup
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-not-available')
    ipcRenderer.removeAllListeners('update-downloaded')
    ipcRenderer.removeAllListeners('update-download-progress')
    ipcRenderer.removeAllListeners('update-error')
  },
  removeWindowMaximizedListener: () => ipcRenderer.removeAllListeners('window-maximized'),
})
