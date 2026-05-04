import React, { useEffect, useState } from 'react'
import { useUpdate } from '../context/UpdateContext'
import { useAuth } from '../context/AuthContext'
import './MandatoryUpdateOverlay.css'

export default function MandatoryUpdateOverlay() {
  const {
    updateStatus,
    updateInfo,
    downloadProgress,
    updateError,
    downloadUpdate,
    installAndRestart,
    checkForUpdate
  } = useUpdate()

  const { hasRole, user } = useAuth()
  const [bypassed, setBypassed] = useState(false)

  const NAS_PATH = '\\\\KMTI-NAS\\Shared\\Public\\APP DEVELOPMENT\\KMTI Workstation'

  const handleOpenNAS = () => {
    if (window.electronAPI?.openFolder) {
      window.electronAPI.openFolder(NAS_PATH)
    }
  }

  const isIT = hasRole?.('it', 'admin') || false;

  // Decide if we should show the overlay directly in the render cycle
  const shouldShow = !bypassed && 
    (updateStatus === 'available' || 
     updateStatus === 'downloading' || 
     updateStatus === 'ready' || 
     (updateStatus === 'error' && updateInfo));

  if (!shouldShow || !user) return null;

  return (
    <div className="mandatory-update-overlay">
      <div className="update-glass-card">
        <div className="update-header">
          <div className="update-icon-pulse">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <h2 className="update-title">System Update Available</h2>
          <p className="update-subtitle">
            A new workstation update (v{updateInfo?.version || 'New'}) available.
            To maintain system integrity, security, and performance, please install the update.
          </p>
        </div>

        <div className="update-body">
          {updateStatus === 'available' && (
            <div className="update-action-zone">
              <button className="update-btn primary" onClick={downloadUpdate}>
                <span>Download & Install Now</span>
              </button>
              <button className="update-link-btn" onClick={handleOpenNAS}>
                Can't see update? Click here to install
              </button>
              <p className="update-hint">The application will restart automatically after download.</p>
            </div>
          )}

          {updateStatus === 'downloading' && (
            <div className="update-progress-zone">
              <div className="progress-container">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
                </div>
                <div className="progress-labels">
                  <span>Downloading security patches...</span>
                  <span>{downloadProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {updateStatus === 'ready' && (
            <div className="update-action-zone">
              <div className="success-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Download Complete</span>
              </div>
              <button className="update-btn success" onClick={installAndRestart}>
                <span>Restart to Apply Update</span>
              </button>
            </div>
          )}

          {updateStatus === 'error' && (
            <div className="update-error-zone">
              <div className="error-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{updateError || 'Update download failed. Please check your internet connection.'}</span>
              </div>
              <div className="update-error-actions">
                <button className="update-btn ghost" onClick={checkForUpdate}>
                  <span>Retry Connection</span>
                </button>
                <button className="update-btn ghost" onClick={handleOpenNAS}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16 }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Open NAS Folder</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="update-footer">
          <button className="bypass-btn" onClick={() => setBypassed(true)}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
