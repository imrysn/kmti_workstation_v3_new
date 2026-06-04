import { useState, useMemo } from 'react'
import type { IQuotation } from '../../types'
import { normalizeClientName } from '../../hooks/useBillingMonitoring'

interface BillingDashboardEnhancementsProps {
  quotations: IQuotation[]
  formatCurrency: (val?: number) => string
  formatDateToSlash: (dateStr?: string | null) => string
  activeYear: number
}

export default function BillingDashboardEnhancements({
  quotations,
  formatCurrency,
  formatDateToSlash,
  activeYear
}: BillingDashboardEnhancementsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'aging' | 'engineers' | 'comparison'>('aging')
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null)

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
      if (!unpaidStatuses.includes(status)) return
      if (q.datePaid) return // If paid, skip

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

  // ── 2. ENGINEER PERFORMANCE COMPUTATION ──────────────────────────────
  const engineerStats = useMemo(() => {
    const stats: Record<string, {
      completed: number
      active: number
      count: number
    }> = {}

    const positiveStatuses = ['Approved', 'Partial Billing', 'Billing Completion']

    quotations.forEach(q => {
      const engineer = q.designerName || 'Unassigned'
      const status = q.quotationStatus || 'For Approval'
      if (!positiveStatuses.includes(status)) return

      if (!stats[engineer]) {
        stats[engineer] = { completed: 0, active: 0, count: 0 }
      }

      const amt = q.grandTotal || 0
      stats[engineer].count++

      if (status === 'Billing Completion') {
        stats[engineer].completed += amt
      } else if (status === 'Approved') {
        stats[engineer].active += amt
      } else if (status === 'Partial Billing') {
        // Assume default 50% split for simple overview
        const completedAmt = amt * 0.5
        const activeAmt = amt * 0.5
        stats[engineer].completed += completedAmt
        stats[engineer].active += activeAmt
      }
    })

    return Object.entries(stats)
      .map(([name, data]) => ({
        name,
        completed: data.completed,
        active: data.active,
        total: data.completed + data.active,
        count: data.count,
        avg: data.count > 0 ? (data.completed + data.active) / data.count : 0
      }))
      .sort((a, b) => b.total - a.total)
  }, [quotations])

  // ── 3. MONTHLY COMPARISON COMPUTATION ────────────────────────────────
  const monthlyComparison = useMemo(() => {
    const currentYearData = Array(12).fill(0)
    const prevYearData = Array(12).fill(0)
    const positiveStatuses = ['Approved', 'Partial Billing', 'Billing Completion']

    quotations.forEach(q => {
      if (!q.date) return
      const status = q.quotationStatus || 'For Approval'
      if (!positiveStatuses.includes(status)) return

      const qDate = new Date(q.date)
      const year = qDate.getFullYear()
      const month = qDate.getMonth()

      if (year === activeYear) {
        currentYearData[month] += q.grandTotal || 0
      } else if (year === activeYear - 1) {
        prevYearData[month] += q.grandTotal || 0
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
    <div className="dashboard-enhancements-panel">
      {/* Panel Headers / Tabs */}
      <div className="enhancements-tabs">
        <button
          className={`enhancements-tab-btn ${activeSubTab === 'aging' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('aging')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Aging Receivables
        </button>
        <button
          className={`enhancements-tab-btn ${activeSubTab === 'engineers' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('engineers')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
            <path d="M12 2a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" />
          </svg>
          Engineer Leaderboard
        </button>
        <button
          className={`enhancements-tab-btn ${activeSubTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('comparison')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          YoY Month Comparison
        </button>
      </div>

      {/* Sub-Panel Contents */}
      <div className="enhancements-content">
        {/* ── AGING PANEL ── */}
        {activeSubTab === 'aging' && (
          <div className="aging-panel">
            <div className="aging-grid">
              {Object.entries(agingData).map(([key, bucket]) => (
                <div
                  key={key}
                  className={`aging-card ${selectedAgingBucket === key ? 'selected' : ''}`}
                  onClick={() => setSelectedAgingBucket(selectedAgingBucket === key ? null : key)}
                >
                  <div className="aging-label">{bucket.label}</div>
                  <div className="aging-value">{formatCurrency(bucket.total)}</div>
                  <div className="aging-count">{bucket.count} outstanding invoices</div>
                  <div className="aging-action-hint">Click to inspect</div>
                </div>
              ))}
            </div>

            {selectedAgingBucket && (
              <div className="aging-details-section">
                <h3>Unpaid Invoices - {agingData[selectedAgingBucket as keyof typeof agingData].label}</h3>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="spreadsheet-table" style={{ minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th>Quotation #</th>
                        <th>Client</th>
                        <th>Engineer</th>
                        <th>Submitted To Admin</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingData[selectedAgingBucket as keyof typeof agingData].items.map(q => (
                        <tr key={q.id}>
                          <td className="cell-qno" style={{ textAlign: 'center' }}>{q.quotationNo}</td>
                          <td>{normalizeClientName(q.billTo)}</td>
                          <td style={{ textAlign: 'center' }}>{q.designerName}</td>
                          <td style={{ textAlign: 'center' }}>{formatDateToSlash(q.submittedToAdminAt)}</td>
                          <td className="cell-amount">{formatCurrency(q.grandTotal)}</td>
                        </tr>
                      ))}
                      {agingData[selectedAgingBucket as keyof typeof agingData].items.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '16px' }}>No invoices in this bucket</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ENGINEERS PANEL ── */}
        {activeSubTab === 'engineers' && (
          <div className="designers-panel">
            <div className="table-container">
              <table className="spreadsheet-table" style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Engineer Name</th>
                    <th>Invoices Count</th>
                    <th>Completed Revenue</th>
                    <th>Forecast / Approved</th>
                    <th>Total Managed Revenue</th>
                    <th>Avg Invoice Value</th>
                  </tr>
                </thead>
                <tbody>
                  {engineerStats.map(stat => (
                    <tr key={stat.name}>
                      <td style={{ fontWeight: '600', paddingLeft: '20px' }}>{stat.name}</td>
                      <td style={{ textAlign: 'center' }}>{stat.count}</td>
                      <td className="cell-amount" style={{ color: '#10b981' }}>{formatCurrency(stat.completed)}</td>
                      <td className="cell-amount" style={{ color: '#3b82f6' }}>{formatCurrency(stat.active)}</td>
                      <td className="cell-amount" style={{ fontWeight: '700' }}>{formatCurrency(stat.total)}</td>
                      <td className="cell-amount">{formatCurrency(stat.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MONTHLY COMPARISON PANEL ── */}
        {activeSubTab === 'comparison' && (
          <div className="comparison-panel">
            <div className="table-container">
              <table className="spreadsheet-table" style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>{activeYear} Sales</th>
                    <th>{activeYear - 1} Sales</th>
                    <th>Variance Amount</th>
                    <th>Variance %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyComparison.map(row => (
                    <tr key={row.name}>
                      <td style={{ fontWeight: '600', paddingLeft: '20px' }}>{row.name}</td>
                      <td className="cell-amount">{formatCurrency(row.current)}</td>
                      <td className="cell-amount">{formatCurrency(row.previous)}</td>
                      <td className={`cell-amount ${row.diff >= 0 ? 'text-green' : 'text-red'}`}>
                        {row.diff >= 0 ? '+' : ''}{formatCurrency(row.diff)}
                      </td>
                      <td className={`cell-amount ${row.pct >= 0 ? 'text-green' : 'text-red'}`} style={{ fontWeight: '700' }}>
                        {row.pct >= 0 ? '+' : ''}{row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-surface)', fontWeight: '700' }}>
                    <td style={{ paddingLeft: '20px' }}>Total Year-to-Date</td>
                    <td className="cell-amount">
                      {formatCurrency(monthlyComparison.reduce((sum, r) => sum + r.current, 0))}
                    </td>
                    <td className="cell-amount">
                      {formatCurrency(monthlyComparison.reduce((sum, r) => sum + r.previous, 0))}
                    </td>
                    <td className="cell-amount">
                      {formatCurrency(
                        monthlyComparison.reduce((sum, r) => sum + r.current, 0) -
                        monthlyComparison.reduce((sum, r) => sum + r.previous, 0)
                      )}
                    </td>
                    <td className="cell-amount">
                      {(() => {
                        const curTotal = monthlyComparison.reduce((sum, r) => sum + r.current, 0)
                        const prevTotal = monthlyComparison.reduce((sum, r) => sum + r.previous, 0)
                        const diff = curTotal - prevTotal
                        const pct = prevTotal > 0 ? (diff / prevTotal) * 100 : curTotal > 0 ? 100 : 0
                        return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
