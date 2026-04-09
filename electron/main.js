const { app, BrowserWindow, ipcMain, shell, dialog, screen, desktopCapturer } = require('electron')
const { spawn, execSync } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')

// v3.6.4-HUD-optimized-modular-architecture
// electron-updater — handles downloads from GitHub Releases
let autoUpdater
try {
  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // --- Auto Updater Events ---
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', info)
  })
  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('update-not-available', info)
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-download-progress', progress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message || 'Update error')
  })
} catch (e) {
  console.warn('>>> electron-updater not available:', e.message)
  autoUpdater = null
}

// app.isPackaged is the correct way to detect production in Electron.
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
    if (!mainWindow || mainWindow.isDestroyed()) return
    const bounds = mainWindow.getBounds()
    windowState = { ...bounds, isMaximized: mainWindow.isMaximized() }
    fs.writeFileSync(stateFile, JSON.stringify(windowState))
  } catch (e) { console.error('Failed to save window state:', e) }
}

function initLogStream() {
  const logFile = path.join(app.getPath('userData'), 'backend.log')
  logStream = fs.createWriteStream(logFile, { flags: 'a' })
  logStream.write(`\n=== App Started: ${new Date().toISOString()} ===\n`)
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
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#f1f5f9',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('resize', saveState)
  mainWindow.on('move', saveState)
  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized', false))
}

function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '..', 'backend', 'main.py')
    : path.join(process.resourcesPath, 'backend', 'dist', 'server.exe')

  console.log(`>>> Starting backend at: ${backendPath}`)

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

  pythonProcess.stdout.on('data', (data) => console.log(`[BACKEND] ${data}`))
  pythonProcess.stderr.on('data', (data) => console.error(`[BACKEND-ERR] ${data}`))
}

function killBackend() {
  if (pythonProcess && pythonProcess.pid) {
    console.log(`>>> Killing backend process (PID: ${pythonProcess.pid})...`)
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pythonProcess.pid}`, { stdio: 'ignore' })
      } else {
        pythonProcess.kill()
      }
    } catch (err) {
      console.warn('>>> Backend was already terminated or could not be killed:', err.message)
    }
    pythonProcess = null
  }
}

// Ensure Windows Notifications display the true app name instead of 'electron.app.Electron'
if (process.platform === 'win32') {
  app.setAppUserModelId('KMTI Workstation')
}

app.whenReady().then(() => {
  initLogStream()

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
  ipcMain.handle('is-window-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isMaximized() : false
  })
  ipcMain.handle('minimize-window', (event) => { BrowserWindow.fromWebContents(event.sender)?.minimize() })
  ipcMain.handle('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
      // Ensure the unmaximized size isn't still taking up the whole screen due to previous bad saved state
      const bounds = win.getBounds()
      const currentMonitor = screen.getDisplayMatching(bounds)
      const { width, height } = currentMonitor.workArea
      const { width: boundsW, height: boundsH } = bounds
      if (boundsW >= width - 20 || boundsW < 1024 || boundsH < 700) {
         win.setBounds({
           width: 1024,
           height: 700,
           x: Math.round(currentMonitor.workArea.x + (width - 1024) / 2),
           y: Math.round(currentMonitor.workArea.y + (height - 700) / 2)
         })
      }
    } else {
      win.maximize()
    }
  })
  ipcMain.handle('close-window', (event) => { BrowserWindow.fromWebContents(event.sender)?.close() })

  ipcMain.handle('login-success', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const currentMonitor = screen.getDisplayMatching(mainWindow.getBounds())
    const { x, y, width, height } = currentMonitor.workArea
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(1024, 700)
    
    // Set explicit restore down dimensions
    mainWindow.setBounds({ 
      x: Math.round(x + (width - 1024) / 2), 
      y: Math.round(y + (height - 700) / 2), 
      width: 1024, 
      height: 700 
    }, false)
    
    // Always start maximized
    mainWindow.maximize()
  })

  ipcMain.handle('logout-reset', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const currentMonitor = screen.getDisplayMatching(mainWindow.getBounds())
    const { x, y, width, height } = currentMonitor.workArea
    const cardW = 440, cardH = 580
    mainWindow.setResizable(false)
    mainWindow.setBounds({
      x: Math.round(x + (width - cardW) / 2),
      y: Math.round(y + (height - cardH) / 2),
      width: cardW,
      height: cardH,
    }, false)
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

  // --- Stopwatch File System Handlers ---
  const { exec } = require('child_process')
  const XLSX = require('xlsx')
  const stopwatchDir = path.join(app.getPath('documents'), 'Stopwatch Recordings')
  const stopwatchFile = path.join(stopwatchDir, 'records.json')
  const excelFile = path.join(stopwatchDir, 'Stopwatch_Records.xlsx')

  ipcMain.handle('get-stopwatch-records', async () => {
    try {
      if (!fs.existsSync(stopwatchDir)) fs.mkdirSync(stopwatchDir, { recursive: true })
      if (!fs.existsSync(stopwatchFile)) return { success: true, data: [] }
      const data = fs.readFileSync(stopwatchFile, 'utf8')
      return { success: true, data: JSON.parse(data) }
    } catch (err) { 
      console.error('[IPC] get-stopwatch-records error:', err)
      return { success: false, data: [], error: err.message } 
    }
  })

  ipcMain.handle('save-stopwatch-records', async (_, records) => {
    try {
      if (!fs.existsSync(stopwatchDir)) fs.mkdirSync(stopwatchDir, { recursive: true })
      
      // 1. Save JSON (Source of truth)
      fs.writeFileSync(stopwatchFile, JSON.stringify(records.slice(0, 50), null, 2))
      
      // 2. Set JSON as hidden (Windows only)
      if (process.platform === 'win32') {
        try { exec(`attrib +h "${stopwatchFile}"`) } catch (e) {}
      }

      // 3. Save Excel (.xlsx) for user viewing
      const worksheetData = records.map(r => ({
          Name: r.name,
          Time: r.time
      }));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
      XLSX.writeFile(workbook, excelFile);

      return { success: true }
    } catch (err) { 
      console.error('[IPC] save-stopwatch-records error:', err)
      return { success: false, error: err.message } 
    }
  })

  ipcMain.handle('open-stopwatch-folder', async () => {
    if (!fs.existsSync(stopwatchDir)) fs.mkdirSync(stopwatchDir, { recursive: true })
    shell.openPath(stopwatchDir)
  })

  // --- Auto Updater IPC Handlers ---
  ipcMain.handle('check-for-update', async () => {
    if (!autoUpdater) return { error: 'Updater not available' }
    return await autoUpdater.checkForUpdates()
  })
  ipcMain.handle('download-update', async () => {
    if (!autoUpdater) return { error: 'Updater not available' }
    return await autoUpdater.downloadUpdate()
  })
  ipcMain.handle('install-and-restart', () => {
    if (!autoUpdater) return
    autoUpdater.quitAndInstall()
  })

  createWindow()
  if (isDev) {
    startBackend()
  } else {
    // Check for updates on startup in production
    autoUpdater?.checkForUpdatesAndNotify()
  }

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
