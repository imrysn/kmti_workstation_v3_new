import React, { useState, useEffect } from 'react'
import './UpdateToast.css'

export default function UpdateToast() {
  const [show, setShow] = useState(false)
  const [version, setVersion] = useState('')
  const NAS_PATH = '\\\\KMTI-NAS\\Shared\\Public\\APP DEVELOPMENT\\KMTI Workstation'

  useEffect(() => {
    const handleNudge = (e: Event) => {
      const data = (e as CustomEvent).detail
      setVersion(data.version)
      setShow(true)
    }

    window.addEventListener('kmti:update-nudge', handleNudge)
    return () => window.removeEventListener('kmti:update-nudge', handleNudge)
  }, [])

  // Auto hide after 12 seconds
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => setShow(false), 12000)
    return () => clearTimeout(timer)
  }, [show])

  const handleOpenNAS = () => {
    if (window.electronAPI?.openFolder) {
      window.electronAPI.openFolder(NAS_PATH)
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="kmti-update-toast">
      <div className="toast-content">
        <div className="toast-icon">✨</div>
        <div className="toast-body">
          <div className="toast-title">Update Available (v{version})</div>
          <div className="toast-message">A new workstation version is ready in the network public folder.</div>
        </div>
      </div>
      <div className="toast-actions">
        <button className="toast-btn primary" onClick={handleOpenNAS}>Open Folder</button>
        <button className="toast-btn dismiss" onClick={() => setShow(false)}>Dismiss</button>
      </div>
    </div>
  )
}
