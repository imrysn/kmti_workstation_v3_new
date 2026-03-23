const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

const isDev = process.env.NODE_ENV !== 'production'
let mainWindow
let pythonProcess

function startPythonServer() {
  const pythonPath = isDev
    ? path.join(__dirname, '..', 'backend', 'main.py')
    : path.join(process.resourcesPath, 'backend', 'main.py')

  const cmd = isDev ? 'python' : path.join(process.resourcesPath, 'backend', 'server.exe')
  const args = isDev ? [pythonPath] : []

  // Pipe stdio to inherit so we can see python logs in the terminal
  pythonProcess = spawn(cmd, args, { stdio: 'inherit' })
  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python server:', err)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    backgroundColor: '#0f1117',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // startPythonServer() // Disabled as per user request to run backend manually
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // if (pythonProcess) pythonProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

// --- IPC Handlers ---
ipcMain.handle('open-folder', async (_, folderPath) => {
  shell.openPath(folderPath)
})

ipcMain.handle('open-file', async (_, filePath) => {
  shell.openPath(filePath)
})

ipcMain.handle('minimize-window', () => mainWindow.minimize())
ipcMain.handle('maximize-window', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.handle('close-window', () => mainWindow.close())

ipcMain.handle('select-folder', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  try {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })
    if (result.canceled) return null
    return result.filePaths[0] || null
  } catch (err) {
    console.error('Error in select-folder IPC:', err)
    return null
  }
})

console.log('Main process reached end of main.js - IPC Handlers registered.')
