import { memo, useCallback, useEffect, useRef } from 'react'
import type { BaseRates } from '../../hooks/quotation'

interface Props {
  isOpen: boolean
  onClose: () => void
  baseRates: BaseRates
  onUpdate: (field: keyof BaseRates, value: number) => void
}

const BaseRatesPanel = memo(({ isOpen, onClose, baseRates, onUpdate }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null)

  const handleUpdate = useCallback((field: keyof BaseRates, value: string) => {
    onUpdate(field, parseFloat(value) || 0)
  }, [onUpdate])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid closing immediately on the trigger button click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Transparent backdrop — catches outside clicks */}
      <div className="brp-backdrop" />

      {/* Slide-over panel */}
      <div className="brp-panel" ref={panelRef} role="dialog" aria-label="Rate Settings">

        {/* Header */}
        <div className="brp-header">
          <div className="brp-header-left">
            <div className="brp-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </div>
            <h3 className="brp-title">Rate Settings</h3>
          </div>
          <button className="brp-close-btn" onClick={onClose} title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="brp-body">

          {/* Time Charge Rates */}
          <div className="brp-section">
            <div className="brp-section-label">Time Charge Rate (¥/hr)</div>
            <div className="brp-field-group">
              <div className="brp-field">
                <label className="brp-label">2D</label>
                <div className="brp-input-wrap">
                  <span className="brp-currency">¥</span>
                  <input
                    type="number"
                    value={baseRates.timeChargeRate2D}
                    onChange={e => handleUpdate('timeChargeRate2D', e.target.value)}
                    className="brp-input"
                    min="0"
                  />
                </div>
              </div>
              <div className="brp-field">
                <label className="brp-label">3D</label>
                <div className="brp-input-wrap">
                  <span className="brp-currency">¥</span>
                  <input
                    type="number"
                    value={baseRates.timeChargeRate3D}
                    onChange={e => handleUpdate('timeChargeRate3D', e.target.value)}
                    className="brp-input"
                    min="0"
                  />
                </div>
              </div>
              <div className="brp-field">
                <label className="brp-label">Others</label>
                <div className="brp-input-wrap">
                  <span className="brp-currency">¥</span>
                  <input
                    type="number"
                    value={baseRates.timeChargeRateOthers}
                    onChange={e => handleUpdate('timeChargeRateOthers', e.target.value)}
                    className="brp-input"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="brp-divider" />

          {/* Overtime */}
          <div className="brp-section">
            <div className="brp-section-label">Overtime</div>
            <div className="brp-field">
              <label className="brp-label">OT Hours Multiplier</label>
              <div className="brp-input-wrap">
                <input
                  type="number"
                  value={baseRates.otHoursMultiplier}
                  onChange={e => handleUpdate('otHoursMultiplier', e.target.value)}
                  className="brp-input"
                  min="0"
                  step="0.1"
                />
                <span className="brp-suffix">×</span>
              </div>
              <div className="brp-hint">Multiplied by 3D rate to compute OT rate</div>
            </div>
            <div className="brp-field" style={{ marginTop: 10 }}>
              <label className="brp-label">Overtime Rate (¥/hr)</label>
              <div className="brp-input-wrap">
                <span className="brp-currency">¥</span>
                <input
                  type="number"
                  value={baseRates.overtimeRate}
                  onChange={e => handleUpdate('overtimeRate', e.target.value)}
                  className="brp-input"
                  min="0"
                />
              </div>
              <div className="brp-hint">Auto-computed from multiplier × 3D rate — editable</div>
            </div>
          </div>

          <div className="brp-divider" />

          {/* Software & Overhead */}
          <div className="brp-section">
            <div className="brp-section-label">Software & Overhead</div>
            <div className="brp-field">
              <label className="brp-label">Software Rate (¥/unit)</label>
              <div className="brp-input-wrap">
                <span className="brp-currency">¥</span>
                <input
                  type="number"
                  value={baseRates.softwareRate}
                  onChange={e => handleUpdate('softwareRate', e.target.value)}
                  className="brp-input"
                  min="0"
                />
              </div>
            </div>
            <div className="brp-field" style={{ marginTop: 10 }}>
              <label className="brp-label">Overhead Percentage</label>
              <div className="brp-input-wrap">
                <input
                  type="number"
                  value={baseRates.overheadPercentage}
                  onChange={e => handleUpdate('overheadPercentage', e.target.value)}
                  className="brp-input"
                  min="0"
                  max="100"
                  step="1"
                />
                <span className="brp-suffix">%</span>
              </div>
              <div className="brp-hint">Applied to (labor + OT + software) subtotal</div>
            </div>
          </div>

          <div className="brp-divider" />

          {/* Live summary */}
          <div className="brp-summary">
            <div className="brp-summary-title">Computed values</div>
            <div className="brp-summary-row">
              <span>OT rate (3D × {baseRates.otHoursMultiplier}×)</span>
              <span className="brp-summary-value">¥{Math.round(baseRates.timeChargeRate3D * baseRates.otHoursMultiplier).toLocaleString()}</span>
            </div>
            <div className="brp-summary-row">
              <span>Overhead on ¥100,000 job</span>
              <span className="brp-summary-value">¥{Math.round(100000 * baseRates.overheadPercentage / 100).toLocaleString()}</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="brp-footer">
          <button className="brp-done-btn" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Done
          </button>
        </div>
      </div>
    </>
  )
})

BaseRatesPanel.displayName = 'BaseRatesPanel'
export default BaseRatesPanel
