import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

interface UpdateContextValue {
  updateStatus: UpdateStatus
  updateInfo: any
  downloadProgress: number
  updateError: string | null
  checkForUpdate: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installAndRestart: () => void
  resetUpdateState: () => void
  simulateUpdate: (status: UpdateStatus) => void
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateError, setUpdateError] = useState<string | null>(null)
  
  // Use a ref to keep track of the current status without causing callback re-creations
  const statusRef = useRef<UpdateStatus>(updateStatus)
  useEffect(() => {
    statusRef.current = updateStatus
  }, [updateStatus])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return

    api.onUpdateAvailable((info: any) => {
      setUpdateStatus('available')
      setUpdateInfo(info)
    })

    api.onUpdateNotAvailable(() => {
      setUpdateStatus('idle')
    })

    api.onUpdateProgress((progress: any) => {
      setUpdateStatus('downloading')
      setDownloadProgress(Math.round(progress.percent))
    })

    api.onUpdateDownloaded((info: any) => {
      setUpdateStatus('ready')
      setUpdateInfo(info)
    })

    api.onUpdateError((err: string) => {
      setUpdateStatus('error')
      setUpdateError(err)
    })

    return () => {
      api.removeUpdateListeners?.()
    }
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (statusRef.current === 'checking' || statusRef.current === 'downloading' || statusRef.current === 'ready') return

    // In dev, we skip the real check to avoid console spam, 
    // unless explicitly triggered (handled by the button calling simulate)
    if (!import.meta.env.PROD) {
      console.log('>>> [UPDATE] Skipping real check for update in DEV mode.')
      return
    }

    setUpdateStatus('checking')
    setUpdateError(null)
    try {
      await window.electronAPI?.checkForUpdate()
    } catch (err: any) {
      setUpdateStatus('error')
      setUpdateError(err.message || 'Failed to check for updates')
    }
  }, [])

  const downloadUpdate = useCallback(async () => {
    setUpdateError(null)
    try {
      await window.electronAPI?.downloadUpdate()
    } catch (err: any) {
      setUpdateStatus('error')
      setUpdateError(err.message || 'Failed to download update')
    }
  }, [])

  const installAndRestart = useCallback(() => {
    window.electronAPI?.installAndRestart()
  }, [])

  const resetUpdateState = useCallback(() => {
    setUpdateStatus('idle')
    setUpdateInfo(null)
    setDownloadProgress(0)
    setUpdateError(null)
  }, [])

  const simulateUpdate = useCallback((status: UpdateStatus) => {
    setUpdateStatus(status)
    if (status === 'available') {
      setUpdateInfo({ version: `${__APP_VERSION__}`, releaseDate: new Date().toISOString() })
    }
    if (status === 'downloading') setDownloadProgress(45)
    if (status === 'error') setUpdateError('MOCK_ERROR: Connection timed out (Simulated)')
  }, [])

  return (
    <UpdateContext.Provider value={{
      updateStatus,
      updateInfo,
      downloadProgress,
      updateError,
      checkForUpdate,
      downloadUpdate,
      installAndRestart,
      resetUpdateState,
      simulateUpdate
    }}>
      {children}
    </UpdateContext.Provider>
  )
}

export function useUpdate() {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useUpdate must be used inside <UpdateProvider>')
  return ctx
}
