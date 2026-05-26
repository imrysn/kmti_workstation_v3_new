import { useState, useEffect } from 'react'
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
        <div className="toast-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="toast-svg">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5 5 3Z" opacity="0.4" />
            <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" opacity="0.4" />
          </svg>
        </div>
        <div className="toast-body">
          <div className="toast-title">Update Available (v{version})</div>
          <div className="toast-message">Still using old version? <br />Some features might not work properly in this version. New workstation version is ready in the network public folder. <br /> </div>
        </div>
      </div>
      <div className="toast-actions">
        <button className="toast-btn primary" onClick={handleOpenNAS}>Update Now</button>
        <button className="toast-btn dismiss" onClick={() => setShow(false)}>Later</button>
      </div>
    </div>
  )
}
