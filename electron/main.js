const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron')
const { spawn, execSync } = require('child_process')
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
  // Start in login mode: small, frameless, transparent
  mainWindow = new BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    frame: false,
    center: true,
    transparent: true,   // lets the OS see through to the desktop
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // --- IPC Handlers ---
  ipcMain.handle('get-file-icon', async (_, filePath, isFolder) => {
    try {
      let targetPath = filePath.split('/').join(path.sep).split('\\\\').join('\\')

      if (isFolder) {
        targetPath = 'C:\\Windows'
      }

      const icon = await app.getFileIcon(targetPath, { size: 'normal' })
      return icon.toDataURL()
    } catch (err) {
      console.error(`>>> [IPC] ERROR:`, err)
      return null
    }
  })

  ipcMain.handle('open-folder', async (_, folderPath) => {
    shell.openPath(folderPath)
  })

  ipcMain.handle('open-file', async (_, filePath) => {
    shell.openPath(filePath)
  })

  // Window controls — resolve to whichever window sent the request
  ipcMain.handle('minimize-window', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
  })
  ipcMain.handle('close-window', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // Login gate: resize the SAME window into full workstation mode.
  // No re-load needed — React auth state is already set, AppContent
  // switches to WorkstationShell automatically.
  // Login gate: expand the same window to fill the full workable screen.
  // NOTE: maximize() doesn't work on transparent frameless windows on Windows,
  // so we use screen.getPrimaryDisplay().workArea + setBounds instead.
  ipcMain.handle('login-success', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(1024, 700)
    mainWindow.setBackgroundColor('#f1f5f9')
    mainWindow.setBounds({ x, y, width, height }, false)
  })

  // Logout: shrink back to the floating login card
  ipcMain.handle('logout-reset', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const { x, y, width, height } = screen.getPrimaryDisplay().workArea
    const cardW = 420, cardH = 560
    mainWindow.setResizable(false)
    mainWindow.setMinimumSize(0, 0)
    mainWindow.setBounds({
      x: Math.round(x + (width - cardW) / 2),
      y: Math.round(y + (height - cardH) / 2),
      width: cardW,
      height: cardH,
    }, false)
    mainWindow.setBackgroundColor('#00000000')  // restore transparency
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
    } catch (err) {
      console.error('Error in select-folder IPC:', err)
      return null
    }
  })

  // Start the embedded Python backend in production builds.
  // In dev, the backend is started manually via `npm run backend`.
  if (!isDev) {
    startPythonServer()
  }

  console.log(`>>> ELECTRON MAIN PROCESS STARTED - Version: 2.4 (isDev: ${isDev})`)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

/**
 * Kills the tracked pythonProcess child AND any orphaned process
 * holding port 8000. The port kill covers:
 *   - Dev mode (backend started manually, not tracked by pythonProcess)
 *   - Production mode where uvicorn spawned worker sub-processes
 *   - Any crash-restart scenario that left a stale process on the port
 */
function killBackend() {
  // 1. Kill the tracked child process if we have one
  if (pythonProcess) {
    try {
      pythonProcess.kill()
    } catch (_) { }
    pythonProcess = null
  }

  // 2. On Windows: find and kill whatever is on port 8000 via netstat + taskkill.
  //    This is synchronous and intentionally brief — we're in shutdown.
  if (process.platform === 'win32') {
    try {
      // netstat -ano lists all connections with PIDs.
      // Find any line with :8000 in LISTENING or ESTABLISHED state.
      const output = execSync('netstat -ano', { timeout: 3000 }).toString()
      const lines = output.split('\n')
      const pids = new Set()

      for (const line of lines) {
        // Match lines like:  TCP  0.0.0.0:8000  ...  LISTENING  1234
        if (line.includes(':8000')) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (pid && /^\d+$/.test(pid) && pid !== '0') {
            pids.add(pid)
          }
        }
      }

      for (const pid of pids) {
        try {
          // /F = force, /T = kill entire process tree
          execSync(`taskkill /PID ${pid} /F /T`, { timeout: 3000 })
          console.log(`>>> Killed port 8000 process PID ${pid}`)
        } catch (_) {
          // PID may have already exited — ignore
        }
      }
    } catch (err) {
      // netstat failed (permissions, timeout) — non-fatal, log and move on
      console.warn('>>> Port 8000 cleanup failed:', err.message)
    }
  } else {
    // macOS / Linux: lsof is available
    try {
      const output = execSync('lsof -ti tcp:8000', { timeout: 3000 }).toString().trim()
      if (output) {
        const pids = output.split('\n').filter(Boolean)
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { timeout: 3000 })
            console.log(`>>> Killed port 8000 process PID ${pid}`)
          } catch (_) { }
        }
      }
    } catch (_) {
      // No process on port 8000, or lsof unavailable — fine
    }
  }
}

app.on('window-all-closed', () => {
  killBackend()
  if (process.platform !== 'darwin') app.quit()
})

// before-quit fires on Cmd+Q, app.quit(), and system shutdown
app.on('before-quit', () => {
  killBackend()
})
