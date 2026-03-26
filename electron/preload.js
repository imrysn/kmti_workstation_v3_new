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
})
