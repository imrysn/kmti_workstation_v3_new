interface BillingKpiCardsProps {
  statusStats: Record<string, { count: number; total: number }>
  totalItems: number
  revenueSum: number
  trendPercent: number
  formatCurrency: (val?: number) => string
}

export default function BillingKpiCards({
  statusStats,
  totalItems,
  revenueSum,
  trendPercent,
  formatCurrency
}: BillingKpiCardsProps) {
  const completedTotal = statusStats['Billing Completion']?.total || 0
  const completedCount = statusStats['Billing Completion']?.count || 0

  const activeTotal = (statusStats['Approved']?.total || 0) + (statusStats['Partial Billing']?.total || 0)
  const activeCount = (statusStats['Approved']?.count || 0) + (statusStats['Partial Billing']?.count || 0)

  const pendingTotal = statusStats['For Approval']?.total || 0
  const pendingCount = statusStats['For Approval']?.count || 0

  const cancelledCount = statusStats['CANCELLED']?.count || 0

  const trendUp = trendPercent >= 0

  return (
    <div className="billing-kpi-row">

      {/* Total Revenue */}
      <div className="kpi-card kpi-green">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-green">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className={`kpi-trend ${trendUp ? 'up' : 'down'}`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trendPercent).toFixed(0)}%
          </span>
        </div>
        <div className="kpi-value">{formatCurrency(revenueSum)}</div>
        <div className="kpi-label">Total Revenue</div>
        <div className="kpi-sub">{totalItems} quotation{totalItems !== 1 ? 's' : ''} in view</div>
      </div>

      {/* Completed / Collected */}
      <div className="kpi-card kpi-purple">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-purple">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="kpi-count-badge kpi-badge-purple">{completedCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(completedTotal)}</div>
        <div className="kpi-label">Billing Completed</div>
        <div className="kpi-sub">Fully collected</div>
      </div>

      {/* Approved & Active */}
      <div className="kpi-card kpi-blue">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <span className="kpi-count-badge kpi-badge-blue">{activeCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(activeTotal)}</div>
        <div className="kpi-label">Approved & Active</div>
        <div className="kpi-sub">In progress</div>
      </div>

      {/* Pending Approval */}
      <div className="kpi-card kpi-amber">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-amber">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span className="kpi-count-badge kpi-badge-amber">{pendingCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(pendingTotal)}</div>
        <div className="kpi-label">Pending Approval</div>
        <div className="kpi-sub">Awaiting review</div>
      </div>

      {/* Cancelled */}
      <div className="kpi-card kpi-red">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-red">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        </div>
        <div className="kpi-value kpi-value-sm">{cancelledCount}</div>
        <div className="kpi-label">Cancelled</div>
        <div className="kpi-sub">Voided quotations</div>
      </div>

    </div>
  )
}
