import { useState } from 'react'
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
          {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'ready' || updateStatus === 'error') && (
            <div className="update-action-zone">
              <button className="update-btn primary" onClick={handleOpenNAS}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>Install Update</span>
              </button>

              <div className="update-instruction-box">
                <div className="instruction-step">
                  <span className="step-num">1</span>
                  <p>Click the button above to open the network distribution folder.</p>
                </div>
                <div className="instruction-step">
                  <span className="step-num">2</span>
                  <p>Uninstall old version of <strong>KMTI Workstation</strong> in Control Panel.</p>
                </div>
                <div className="instruction-step">
                  <span className="step-num">3</span>
                  <p>Run <strong>KMTI_Workstation_Setup.exe</strong> to start the installation.</p>
                </div>
                <div className="instruction-step">
                  <span className="step-num">4</span>
                  <p>The application will close and update to <strong>v{updateInfo?.version || 'New'}</strong>.</p>
                </div>
              </div>

              {updateStatus === 'error' && updateError && (
                <div className="update-error-mini">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Auto-check error: {updateError}</span>
                </div>
              )}
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
