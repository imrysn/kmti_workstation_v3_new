import { useState, useMemo, useEffect } from 'react'
import type { IQuotation } from '../../types'

interface BillingGoalTrackerProps {
  revenueSum: number
  quotations: IQuotation[]
  formatCurrency: (val?: number) => string
  timeframe: 'week' | 'month' | 'year'
}

export default function BillingGoalTracker({ revenueSum, quotations, formatCurrency, timeframe }: BillingGoalTrackerProps) {
  const [goal, setGoal] = useState<number>(8000000) // Default monthly placeholder, initialized properly in useEffect
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false)
  const [goalInput, setGoalInput] = useState<string>('8,000,000')

  // Dynamically load goal when timeframe changes
  useEffect(() => {
    const key = `kmti_billing_revenue_target_${timeframe}`
    const saved = localStorage.getItem(key)
    let initialGoal = 8000000

    if (saved) {
      const parsed = parseInt(saved)
      if (!isNaN(parsed) && parsed > 0) {
        initialGoal = parsed
      }
    } else {
      // Timeframe-specific default targets
      if (timeframe === 'week') {
        initialGoal = 2000000  // ¥2,000,000 weekly default
      } else if (timeframe === 'month') {
        initialGoal = 8000000  // ¥8,000,000 monthly default
      } else {
        initialGoal = 80000000 // ¥80,000,000 yearly default
      }
    }

    setGoal(initialGoal)
    setGoalInput(initialGoal.toLocaleString())
  }, [timeframe])

  // Calculate stats based on revenueSum
  const percent = useMemo(() => {
    if (goal <= 0) return 0
    return Math.min(Math.round((revenueSum / goal) * 100), 100)
  }, [revenueSum, goal])

  const actualPercentRaw = useMemo(() => {
    if (goal <= 0) return 0
    return (revenueSum / goal) * 100
  }, [revenueSum, goal])

  const remaining = useMemo(() => {
    return Math.max(0, goal - revenueSum)
  }, [revenueSum, goal])

  // Average deal value calculation for active/completed deals
  const avgDealValue = useMemo(() => {
    const activeDeals = quotations.filter(q =>
      ['Billing Completion', 'Approved', 'Partial Billing'].includes(q.quotationStatus || '')
    )
    if (activeDeals.length === 0) return 0
    const totalActiveSum = activeDeals.reduce((sum, q) => sum + (q.grandTotal || 0), 0)
    return Math.round(totalActiveSum / activeDeals.length)
  }, [quotations])

  // Performance status tag
  const statusInfo = useMemo(() => {
    if (actualPercentRaw >= 100) {
      return { label: 'Goal Achieved', className: 'achieved' }
    } else if (actualPercentRaw >= 75) {
      return { label: 'Excellent Progress', className: 'excellent' }
    } else if (actualPercentRaw >= 40) {
      return { label: 'On Track', className: 'on-track' }
    } else {
      return { label: 'Behind Target', className: 'behind' }
    }
  }, [actualPercentRaw])

  const handleSaveGoal = () => {
    const cleanNum = parseInt(goalInput.replace(/,/g, ''))
    if (!isNaN(cleanNum) && cleanNum > 0) {
      setGoal(cleanNum)
      setGoalInput(cleanNum.toLocaleString())
      localStorage.setItem(`kmti_billing_revenue_target_${timeframe}`, cleanNum.toString())
      setIsEditingGoal(false)
    } else {
      setGoalInput(goal.toLocaleString())
      setIsEditingGoal(false)
    }
  }

  const handleInputChange = (val: string) => {
    // Keep only numbers
    const cleanVal = val.replace(/[^\d]/g, '')
    if (cleanVal) {
      const num = parseInt(cleanVal)
      setGoalInput(num.toLocaleString())
    } else {
      setGoalInput('')
    }
  }

  const timeframeLabel = useMemo(() => {
    if (timeframe === 'week') return 'Weekly'
    if (timeframe === 'month') return 'Monthly'
    return 'Yearly'
  }, [timeframe])

  return (
    <div className="goal-tracker-panel">
      <div className="goal-header">
        <div className="goal-title-group">
          <div className="goal-badge-row">
            <span className="goal-icon-sparkle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            <h3>{timeframeLabel} Revenue Progress</h3>
            <span className={`goal-status-tag ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Goal editor interface */}
        <div className="goal-setting-container">
          {isEditingGoal ? (
            <div className="goal-input-wrapper">
              <span className="currency-symbol">¥</span>
              <input
                type="text"
                value={goalInput}
                onChange={e => handleInputChange(e.target.value)}
                onBlur={handleSaveGoal}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveGoal() }}
                autoFocus
                className="goal-input-field"
              />
              <button className="goal-btn save" onClick={handleSaveGoal}>
                Save
              </button>
            </div>
          ) : (
            <div className="goal-display-wrapper">
              <span className="goal-display-lbl">Target: </span>
              <span className="goal-display-val">{formatCurrency(goal)}</span>
              <button
                className="goal-edit-btn"
                onClick={() => setIsEditingGoal(true)}
                title="Edit Target Goal"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="goal-progress-section">
        {/* Progress Bar Container */}
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${percent}%` }}
          >
            <div className="progress-bar-shimmer"></div>
          </div>
          {percent > 0 && (
            <span 
              className="progress-tooltip-bubble"
              style={{ left: `${percent}%` }}
            >
              {percent}%
            </span>
          )}
        </div>

        {/* Labels below progress bar */}
        <div className="progress-labels">
          <span className="progress-percentage-label">Completion Status</span>
          <span className="progress-deficit-label">
            {remaining > 0 ? (
              `${formatCurrency(remaining)} remaining`
            ) : (
              <span className="goal-achieved-announcement">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: '4px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Target Exceeded!
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Grid detailing performance breakdown */}
      <div className="goal-stats-grid">
        <div className="goal-stat-card">
          <span className="stat-card-lbl">Current Billing Total</span>
          <span className="stat-card-val sum-highlight">{formatCurrency(revenueSum)}</span>
        </div>

        <div className="goal-stat-card">
          <span className="stat-card-lbl">Average Deal Value</span>
          <span className="stat-card-val">{formatCurrency(avgDealValue)}</span>
        </div>

        <div className="goal-stat-card">
          <span className="stat-card-lbl">Remaining Deficit</span>
          <span className="stat-card-val deficit-highlight">
            {remaining > 0 ? formatCurrency(remaining) : '¥0'}
          </span>
        </div>
      </div>
    </div>
  )
}
