import { useMemo } from 'react'
import type { IQuotation } from '../../types'
import { normalizeClientName } from '../../hooks/useBillingMonitoring'

interface BillingDashboardEnhancementsProps {
  quotations: IQuotation[]
  formatCurrency: (val?: number) => string
  activeYear: number
  getCompletedAmount: (q: IQuotation) => number
  selectedAgingBucket: string | null
  setSelectedAgingBucket: (bucket: string | null) => void
  setActiveView: (view: 'dashboard' | 'table' | 'statement') => void
}

export default function BillingDashboardEnhancements({
  quotations,
  formatCurrency,
  activeYear,
  getCompletedAmount,
  selectedAgingBucket,
  setSelectedAgingBucket,
  setActiveView
}: BillingDashboardEnhancementsProps) {

  // ── 1. AGING COMPUTATION ──────────────────────────────────────────────
  const agingData = useMemo(() => {
    const buckets = {
      '0-30': { label: '0 - 30 Days', count: 0, total: 0, items: [] as IQuotation[] },
      '31-60': { label: '31 - 60 Days', count: 0, total: 0, items: [] as IQuotation[] },
      '61-90': { label: '61 - 90 Days', count: 0, total: 0, items: [] as IQuotation[] },
      '90+': { label: '90+ Days (Overdue)', count: 0, total: 0, items: [] as IQuotation[] },
    }

    const unpaidStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
    const today = new Date()

    quotations.forEach(q => {
      const status = q.quotationStatus || 'For Approval'
      const billingStatus = q.billingStatus || ''
      const isUnpaid = unpaidStatuses.includes(status) || billingStatus === 'BILLED' || billingStatus === 'FOR BILLING'
      if (!isUnpaid) return
      if (q.datePaid || billingStatus === 'PAID') return // If paid, skip

      // Start date: submittedToAdminAt, fallback to date, fallback to modifiedAt
      const startStr = q.submittedToAdminAt || q.date || q.modifiedAt
      if (!startStr) return

      const startDate = new Date(startStr)
      if (isNaN(startDate.getTime())) return

      const diffTime = Math.max(0, today.getTime() - startDate.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      const amt = q.grandTotal || 0

      if (diffDays <= 30) {
        buckets['0-30'].count++
        buckets['0-30'].total += amt
        buckets['0-30'].items.push(q)
      } else if (diffDays <= 60) {
        buckets['31-60'].count++
        buckets['31-60'].total += amt
        buckets['31-60'].items.push(q)
      } else if (diffDays <= 90) {
        buckets['61-90'].count++
        buckets['61-90'].total += amt
        buckets['61-90'].items.push(q)
      } else {
        buckets['90+'].count++
        buckets['90+'].total += amt
        buckets['90+'].items.push(q)
      }
    })

    return buckets
  }, [quotations])



  // ── 3. MONTHLY COMPARISON COMPUTATION ────────────────────────────────
  const monthlyComparison = useMemo(() => {
    const currentYearData = Array(12).fill(0)
    const prevYearData = Array(12).fill(0)

    quotations.forEach(q => {
      if (!q.date) return
      const completedAmt = getCompletedAmount(q)
      if (completedAmt === 0) return

      const qDate = new Date(q.date)
      const year = qDate.getFullYear()
      const month = qDate.getMonth()

      if (year === activeYear) {
        currentYearData[month] += completedAmt
      } else if (year === activeYear - 1) {
        prevYearData[month] += completedAmt
      }
    })

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    return monthNames.map((name, i) => {
      const cur = currentYearData[i]
      const prev = prevYearData[i]
      const diff = cur - prev
      const pct = prev > 0 ? (diff / prev) * 100 : cur > 0 ? 100 : 0
      return { name, current: cur, previous: prev, diff, pct }
    })
  }, [quotations, activeYear])

  return (
    <div className="enhancements-split-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', width: '100%' }}>
      {/* ── AGING PANEL CARD ── */}
      <div className="dashboard-enhancements-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Aging Receivables</h2>
        </div>
        <div className="enhancements-content" style={{ padding: '20px', flex: 1 }}>
          <div className="aging-panel">
            <div className="aging-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {Object.entries(agingData).map(([key, bucket]) => {
                let bucketIcon = null
                let cardClass = ""
                if (key === '0-30') {
                  cardClass = "aging-card-green"
                  bucketIcon = (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )
                } else if (key === '31-60') {
                  cardClass = "aging-card-blue"
                  bucketIcon = (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )
                } else if (key === '61-90') {
                  cardClass = "aging-card-amber"
                  bucketIcon = (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  )
                } else {
                  cardClass = "aging-card-red"
                  bucketIcon = (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )
                }

                return (
                  <div
                    key={key}
                    className={`aging-card ${cardClass} ${selectedAgingBucket === key ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedAgingBucket(key)
                      setActiveView('table')
                    }}
                    style={{ cursor: 'pointer', margin: 0 }}
                  >
                    <div className="aging-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div className="aging-label">{bucket.label}</div>
                      <span className="aging-card-icon">{bucketIcon}</span>
                    </div>
                    <div className="aging-value" style={{ fontSize: '18px', fontWeight: '700', margin: '6px 0' }}>{formatCurrency(bucket.total)}</div>
                    <div className="aging-count" style={{ fontSize: '10.5px' }}>{bucket.count} invoices</div>
                    <div className="aging-action-hint">
                      Click to inspect <span className="arrow">→</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedAgingBucket && (
              <div className="aging-details-section" style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Unpaid - {agingData[selectedAgingBucket as keyof typeof agingData].label}
                </h3>
                <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="spreadsheet-table" style={{ minWidth: '100%', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Quotation #</th>
                        <th>Client</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingData[selectedAgingBucket as keyof typeof agingData].items.map(q => (
                        <tr key={q.id}>
                          <td className="cell-qno" style={{ textAlign: 'center' }}>{q.quotationNo}</td>
                          <td>{normalizeClientName(q.billTo)}</td>
                          <td className="cell-amount">{formatCurrency(q.grandTotal)}</td>
                        </tr>
                      ))}
                      {agingData[selectedAgingBucket as keyof typeof agingData].items.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', padding: '12px' }}>No invoices in this bucket</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── YOY MONTH COMPARISON CARD ── */}
      <div className="dashboard-enhancements-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>YoY Month Comparison</h2>
        </div>
        <div className="enhancements-content" style={{ padding: '20px', flex: 1 }}>
          <div className="comparison-panel">
            <div className="table-container" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table className="spreadsheet-table" style={{ minWidth: '100%', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>{activeYear} Sales</th>
                    <th>{activeYear - 1} Sales</th>
                    <th>Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyComparison.map(row => (
                    <tr key={row.name}>
                      <td style={{ fontWeight: '600', paddingLeft: '8px' }}>{row.name.substring(0, 3)}</td>
                      <td className="cell-amount">{formatCurrency(row.current)}</td>
                      <td className="cell-amount">{formatCurrency(row.previous)}</td>
                      <td className="cell-amount" style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <span className={row.pct >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: '700', minWidth: '48px', textAlign: 'right' }}>
                            {row.pct >= 0 ? '+' : ''}{row.pct.toFixed(1)}%
                          </span>
                          <div className="variance-track" style={{ width: '90px', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                            {row.pct >= 0 ? (
                              <div 
                                className="variance-bar-positive" 
                                style={{ 
                                  position: 'absolute', 
                                  left: '50%', 
                                  width: `${Math.min(row.pct / 2, 50)}%`, 
                                  height: '100%', 
                                  background: '#10b981', 
                                  borderRadius: '0 3px 3px 0' 
                                }} 
                              />
                            ) : (
                              <div 
                                className="variance-bar-negative" 
                                style={{ 
                                  position: 'absolute', 
                                  right: '50%', 
                                  width: `${Math.min(Math.abs(row.pct) / 2, 50)}%`, 
                                  height: '100%', 
                                  background: '#ef4444', 
                                  borderRadius: '3px 0 0 3px' 
                                }} 
                              />
                            )}
                            <div style={{ position: 'absolute', left: '50%', width: '1px', height: '100%', background: 'var(--border)', zIndex: 2 }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-surface)', fontWeight: '700' }}>
                    <td style={{ paddingLeft: '8px' }}>Total</td>
                    <td className="cell-amount">
                      {formatCurrency(monthlyComparison.reduce((sum, r) => sum + r.current, 0))}
                    </td>
                    <td className="cell-amount">
                      {formatCurrency(monthlyComparison.reduce((sum, r) => sum + r.previous, 0))}
                    </td>
                    <td className="cell-amount" style={{ verticalAlign: 'middle' }}>
                      {(() => {
                        const curTotal = monthlyComparison.reduce((sum, r) => sum + r.current, 0)
                        const prevTotal = monthlyComparison.reduce((sum, r) => sum + r.previous, 0)
                        const diff = curTotal - prevTotal
                        const pct = prevTotal > 0 ? (diff / prevTotal) * 100 : curTotal > 0 ? 100 : 0
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <span className={pct >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: '700', minWidth: '48px', textAlign: 'right' }}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                            </span>
                            <div className="variance-track" style={{ width: '90px', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                              {pct >= 0 ? (
                                <div 
                                  className="variance-bar-positive" 
                                  style={{ 
                                    position: 'absolute', 
                                    left: '50%', 
                                    width: `${Math.min(pct / 2, 50)}%`, 
                                    height: '100%', 
                                    background: '#10b981', 
                                    borderRadius: '0 3px 3px 0' 
                                  }} 
                                />
                              ) : (
                                <div 
                                  className="variance-bar-negative" 
                                  style={{ 
                                    position: 'absolute', 
                                    right: '50%', 
                                    width: `${Math.min(Math.abs(pct) / 2, 50)}%`, 
                                    height: '100%', 
                                    background: '#ef4444', 
                                    borderRadius: '3px 0 0 3px' 
                                  }} 
                                />
                              )}
                              <div style={{ position: 'absolute', left: '50%', width: '1px', height: '100%', background: 'var(--border)', zIndex: 2 }} />
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
