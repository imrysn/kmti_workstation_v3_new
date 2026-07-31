import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'error'

interface UpdateContextValue {
  updateStatus: UpdateStatus
  updateInfo: any
  updateError: string | null
  checkForUpdate: () => Promise<void>
  resetUpdateState: () => void
  simulateUpdate: (status: UpdateStatus) => void
}

const UpdateContext = createContext<UpdateContextValue | null>(null)

function sanitizeUpdateError(rawErr: any): string {
  if (!rawErr) return 'Connection lost'
  const errStr = typeof rawErr === 'string' ? rawErr : (rawErr.message || JSON.stringify(rawErr))
  
  if (
    errStr.includes('404') ||
    errStr.includes('releases.atom') ||
    errStr.includes('github.com') ||
    errStr.includes('remote method') ||
    errStr.includes('HttpError')
  ) {
    return 'Cloud update feed not found on GitHub. Please use "Manual Update via NAS" to download the latest setup installer.'
  }
  
  return errStr.length > 180 ? errStr.slice(0, 180) + '...' : errStr
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
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

    api.onUpdateError((err: string) => {
      setUpdateStatus('error')
      setUpdateError(sanitizeUpdateError(err))
    })

    return () => {
      api.removeUpdateListeners?.()
    }
  }, [])

  const checkForUpdate = useCallback(async () => {
    if (statusRef.current === 'checking') return

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
      setUpdateError(sanitizeUpdateError(err))
    }
  }, [])

  const resetUpdateState = useCallback(() => {
    setUpdateStatus('idle')
    setUpdateInfo(null)
    setUpdateError(null)
  }, [])

  const simulateUpdate = useCallback((status: UpdateStatus) => {
    setUpdateStatus(status)
    if (status === 'available') {
      const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
      setUpdateInfo({ version: version, releaseDate: new Date().toISOString() })
    }
    if (status === 'error') setUpdateError('MOCK_ERROR: Connection timed out (Simulated)')
  }, [])

  return (
    <UpdateContext.Provider value={{
      updateStatus,
      updateInfo,
      updateError,
      checkForUpdate,
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
