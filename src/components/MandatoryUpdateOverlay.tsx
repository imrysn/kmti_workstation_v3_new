import { useState, useEffect } from 'react'
import { useUpdate } from '../context/UpdateContext'
import { useAuth } from '../context/AuthContext'
import './modals/WhatsNewModal.css'
import './MandatoryUpdateOverlay.css'

export default function MandatoryUpdateOverlay() {
  const {
    updateStatus,
    updateInfo,
    updateError,
  } = useUpdate()

  const { user } = useAuth()
  const [bypassed, setBypassed] = useState(false)
  const [activeStep, setActiveStep] = useState(1)

  const progressHeight = activeStep === 1 ? '0%' : '100%'

  // Snooze overlay for 5 minutes when bypassed
  useEffect(() => {
    if (!bypassed) return

    console.log('>>> [UPDATE] Snoozing update dialog for 5 minutes...')
    const timer = setTimeout(() => {
      console.log('>>> [UPDATE] Snooze elapsed. Prompting update dialog again.')
      setBypassed(false)
    }, 5 * 60 * 1000)

    return () => clearTimeout(timer)
  }, [bypassed])

  const NAS_PATH = '\\\\KMTI-NAS\\Shared\\Public\\APP DEVELOPMENT\\KMTI Workstation'

  const handleOpenNAS = () => {
    if (window.electronAPI?.openFolder) {
      window.electronAPI.openFolder(NAS_PATH)
    }
    // Auto-advance stepper to Step 2
    if (activeStep === 1) {
      setActiveStep(2)
    }
  }

  // Decide if we should show the overlay directly in the render cycle
  const shouldShow = !bypassed &&
    (updateStatus === 'available' ||
      (updateStatus === 'error' && updateInfo));

  if (!shouldShow || !user) return null;

  return (
    <div className="wnm-overlay" style={{ zIndex: 100000 }}>
      <div className="wnm-modal" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="wnm-header" style={{ borderBottom: 'none' }}>
          <div className="wnm-header-top">
            <div className="wnm-icon-wrap" style={{ background: '#2563eb' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>

            <div className="wnm-title-group">
              <h2 className="wnm-title">System Update Available</h2>
              <p className="wnm-subtitle">Workstation v{updateInfo?.version || 'New'}</p>
            </div>

            <button className="wnm-close-btn" onClick={() => setBypassed(true)} title="Remind me later">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="wnm-body" style={{ padding: '0 24px 20px', overflowY: 'auto' }}>
          <p style={{ margin: '0 0 18px 0', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            To maintain system integrity, security, and performance, please install the update:
          </p>

          <div className="update-stepper">
            <div className="stepper-line" />
            <div className="stepper-line-progress" style={{ height: progressHeight }} />

            {/* Step 1 */}
            <div 
              className={`stepper-step ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}`}
              onClick={() => setActiveStep(1)}
            >
              <div className="stepper-circle">
                {activeStep > 1 ? '✓' : '1'}
              </div>
              <div className="stepper-card">
                <p className="stepper-desc">Click the button below to open the network distribution folder.</p>
                {activeStep === 1 && (
                  <div className="stepper-helper">
                    <button className="stepper-action-btn" onClick={(e) => { e.stopPropagation(); handleOpenNAS(); }}>
                      Open NAS Folder ➔
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div 
              className={`stepper-step ${activeStep === 2 ? 'active' : ''}`}
              onClick={() => setActiveStep(2)}
            >
              <div className="stepper-circle">2</div>
              <div className="stepper-card">
                <p className="stepper-desc">Close the application and run <strong>KMTI_Workstation_Setup.exe</strong> to start the installation.</p>
                {activeStep === 2 && (
                  <p className="stepper-helper">
                    Double-click the setup file in the shared folder to begin the upgrade. The app will be updated to <strong>v{updateInfo?.version || 'New'}</strong> and can be relaunched immediately after.
                  </p>
                )}
              </div>
            </div>
          </div>

          {updateStatus === 'error' && updateError && (
            <div className="update-error-mini" style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Auto-check error: {updateError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wnm-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="bypass-btn" onClick={() => setBypassed(true)} style={{ background: 'transparent', border: 'none', color: '#8e8e93', fontSize: '14px', cursor: 'pointer', padding: '8px 16px', fontWeight: 500 }}>
            Remind me later
          </button>
          
          <button className="wnm-got-it-btn" onClick={handleOpenNAS} style={{ background: '#2563eb', border: 'none', color: '#fff' }}>
            Install Update
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 8 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
