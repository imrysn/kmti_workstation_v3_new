const { app, BrowserWindow, ipcMain, shell, dialog, screen, desktopCapturer } = require('electron')
const { spawn, execSync } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')

// electron-updater — handles downloads from GitHub Releases
let autoUpdater
try {
  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
} catch (e) {
  console.warn('>>> electron-updater not available:', e.message)
  autoUpdater = null
}

// app.isPackaged is the correct way to detect production in Electron.
// process.env.NODE_ENV is NOT set by electron-builder — never use it for this.
const isDev = !app.isPackaged
let mainWindow
let pythonProcess = null
let logStream

// --- Window State Management ---
const stateFile = path.join(app.getPath('userData'), 'window-state.json')
let windowState = { width: 450, height: 600, x: undefined, y: undefined, isMaximized: false }

function loadState() {
  try {
    if (fs.existsSync(stateFile)) {
      const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
      if (!raw.width || raw.width < 400 || raw.height < 400) {
        fs.unlinkSync(stateFile)
      }
    }
  } catch (_) {}
  try {
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        const displays = screen.getAllDisplays()
        const isVisible = displays.some(display => {
          const { x, y, width, height } = display.bounds
          return (
            data.x >= x &&
            data.x < x + width &&
            data.y >= y &&
            data.y < y + height
          )
        })
        if (isVisible) {
          windowState = data
        }
      }
    }
  } catch (e) { console.error('Failed to load window state:', e) }
}

function saveState() {
  try {
    const bounds = mainWindow.getBounds()
    windowState = { ...bounds, isMaximized: mainWindow.isMaximized() }
    fs.writeFileSync(stateFile, JSON.stringify(windowState))
  } catch (e) { console.error('Failed to save window state:', e) }
}

function initLogStream() {
  const logFile = path.join(app.getPath('userData'), 'backend.log')
  logStream = fs.createWriteStream(logFile, { flags: 'a' })
  logStream.write(`\n=== App Started: ${new Date().toISOString()} ===\n`)
  logStream.write(`isDev: ${isDev}\n`)
  logStream.write(`app.isPackaged: ${app.isPackaged}\n`)
  logStream.write(`__dirname: ${__dirname}\n`)
  logStream.write(`app.getAppPath(): ${app.getAppPath()}\n`)
  logStream.write(`process.resourcesPath: ${process.resourcesPath}\n`)
}


function createWindow() {
  loadState()

  mainWindow = new BrowserWindow({
    width: 440,
    height: 580,
    resizable: true,
    frame: false,
    center: true,
    transparent: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'kmti_logo.png'),
    backgroundColor: '#f1f5f9',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Candidate 1 is correct for asar builds: __dirname = app.asar/electron
    // so '../dist/index.html' = app.asar/dist/index.html — valid asar virtual path
    const candidates = [
      path.join(__dirname, '..', 'dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    ]

    let indexPath = null
    for (const candidate of candidates) {
      const exists = fs.existsSync(candidate)
      logStream.write(`Checking: ${candidate} → ${exists}\n`)
      if (exists && !indexPath) indexPath = candidate
    }

    if (indexPath) {
      logStream.write(`Loading: ${indexPath}\n`)
      mainWindow.loadFile(indexPath)
    } else {
      const fallback = `file:///${path.join(app.getAppPath(), 'dist', 'index.html').replace(/\\/g, '/')}`
      logStream.write(`No candidate found. Fallback URL: ${fallback}\n`)
      mainWindow.loadURL(fallback)
    }
  }

  mainWindow.on('resize', saveState)
  mainWindow.on('move', saveState)
}

function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', 'backend', 'main.py')
    : path.join(process.resourcesPath, 'backend', 'dist', 'server.exe')

  console.log(`>>> Starting backend at: ${backendPath}`)
  logStream.write(`Starting backend at: ${backendPath}\n`)

  if (isDev) {
    pythonProcess = spawn('python', [backendPath], {
      stdio: 'pipe',
      detached: false
    })
  } else {
    pythonProcess = spawn(backendPath, [], {
      stdio: 'pipe',
      detached: false
    })
  }

  pythonProcess.stdout.on('data', (data) => {
    const msg = data.toString()
    console.log(`[BACKEND] ${msg}`)
    logStream.write(`[BACKEND] ${msg}`)
  })

  pythonProcess.stderr.on('data', (data) => {
    const msg = data.toString()
    console.error(`[BACKEND-ERR] ${msg}`)
    logStream.write(`[BACKEND-ERR] ${msg}`)
  })

  pythonProcess.on('error', (err) => {
    console.error('>>> Failed to start backend:', err)
    logStream.write(`Failed to start backend: ${err}\n`)
  })
}

function killBackend() {
  if (pythonProcess) {
    console.log('>>> Killing backend process...')
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pythonProcess.pid}`, { stdio: 'ignore' })
    } else {
      pythonProcess.kill()
    }
    pythonProcess = null
  }
}

app.whenReady().then(() => {
  initLogStream()

  function setupAutoUpdater() {
    if (!autoUpdater || isDev) return
    autoUpdater.on('checking-for-update', () => { console.log('>>> Checking for update...') })
    autoUpdater.on('update-available', (info) => { mainWindow?.webContents.send('update-available', info) })
    autoUpdater.on('update-not-available', (info) => { mainWindow?.webContents.send('update-not-available', info) })
    autoUpdater.on('download-progress', (progress) => { mainWindow?.webContents.send('update-download-progress', progress) })
    autoUpdater.on('update-downloaded', (info) => { mainWindow?.webContents.send('update-downloaded', info) })
    autoUpdater.on('error', (err) => { mainWindow?.webContents.send('update-error', err.message) })
    setTimeout(() => autoUpdater.checkForUpdates(), 30000)
  }

  ipcMain.handle('check-for-update', () => { if (autoUpdater && !isDev) autoUpdater.checkForUpdates() })
  ipcMain.handle('download-update', () => { if (autoUpdater && !isDev) autoUpdater.downloadUpdate() })
  ipcMain.handle('install-and-restart', () => { if (autoUpdater && !isDev) autoUpdater.quitAndInstall(false, true) })

  ipcMain.handle('get-file-icon', async (_, filePath, isFolder) => {
    try {
      let targetPath = filePath.split('/').join(path.sep).split('\\\\').join('\\')
      if (isFolder) targetPath = 'C:\\Windows'
      const icon = await app.getFileIcon(targetPath, { size: 'normal' })
      return icon.toDataURL()
    } catch (err) { return null }
  })

  ipcMain.handle('open-folder', async (_, folderPath) => { shell.openPath(folderPath) })
  ipcMain.handle('open-file', async (_, filePath) => { shell.openPath(filePath) })
  ipcMain.handle('minimize-window', (event) => { BrowserWindow.fromWebContents(event.sender)?.minimize() })
  ipcMain.handle('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
  })
  ipcMain.handle('close-window', (event) => { BrowserWindow.fromWebContents(event.sender)?.close() })

  ipcMain.handle('login-success', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const currentMonitor = screen.getDisplayMatching(mainWindow.getBounds())
    const { x, y, width, height } = currentMonitor.workArea
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(1024, 700)
    mainWindow.setBackgroundColor('#f1f5f9')
    if (windowState.width > 500) {
      mainWindow.setBounds({ x: windowState.x ?? x, y: windowState.y ?? y, width: windowState.width, height: windowState.height }, false)
    } else {
      mainWindow.setBounds({ x, y, width, height }, false)
    }
  })

  ipcMain.handle('logout-reset', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const currentMonitor = screen.getDisplayMatching(mainWindow.getBounds())
    const { x, y, width, height } = currentMonitor.workArea
    const cardW = 440, cardH = 580
    mainWindow.setResizable(false)
    mainWindow.setMinimumSize(0, 0)
    mainWindow.setBounds({
      x: Math.round(x + (width - cardW) / 2),
      y: Math.round(y + (height - cardH) / 2),
      width: cardW,
      height: cardH,
    }, false)
    mainWindow.setBackgroundColor('#f1f5f9')
  })

  ipcMain.handle('select-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    try {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      })
      if (result.canceled) return null
      return result.filePaths[0] || null
    } catch (err) { return null }
  })

  ipcMain.handle('get-workstation-info', async () => ({
    computerName: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    username: os.userInfo().username,
  }))

  ipcMain.handle('capture-screenshot', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 1920, height: 1080 }
      })
      const entireScreen = sources.find(s => s.name === 'Entire Screen' || s.name === 'Screen 1') || sources[0]
      return entireScreen ? entireScreen.thumbnail.toDataURL() : null
    } catch (err) { return null }
  })



  createWindow()
  setupAutoUpdater()
  startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  killBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { })
