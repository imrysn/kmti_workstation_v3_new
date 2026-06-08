interface BillingKpiCardsProps {
  statusStats: Record<string, { count: number; total: number }>
  totalItems: number
  revenueSum: number
  trendPercent: number
  formatCurrency: (val?: number) => string
  vertical?: boolean
}

export default function BillingKpiCards({
  statusStats,
  formatCurrency,
  vertical = false
}: BillingKpiCardsProps) {
  const completedTotal = statusStats['Billing Completion']?.total || 0
  const completedCount = statusStats['Billing Completion']?.count || 0

  const activeTotal = (statusStats['Approved']?.total || 0) + (statusStats['Partial Billing']?.total || 0)
  const activeCount = (statusStats['Approved']?.count || 0) + (statusStats['Partial Billing']?.count || 0)

  const pendingTotal = statusStats['For Approval']?.total || 0
  const pendingCount = statusStats['For Approval']?.count || 0

  const cancelledCount = statusStats['CANCELLED']?.count || 0
  const cancelledTotal = statusStats['CANCELLED']?.total || 0

  return (
    <div className={vertical ? "billing-kpi-column" : "billing-kpi-row"}>

      {/* Total Sales (PAID + Paid portion of Partial Billing) */}
      <div className="kpi-card kpi-green">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-green" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 12V21M12 12L6 5M12 12L18 5M8 14H16M9 17H15" />
            </svg>
          </div>
          <span className="kpi-count-badge kpi-badge-green" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
            {completedCount}
          </span>
        </div>
        <div className="kpi-value">{formatCurrency(completedTotal)}</div>
        <div className="kpi-label">Total Sales (PAID)</div>
        <div className="kpi-sub">Paid invoices & downpayments</div>
      </div>

      {/* Forecast (BILLED / In Progress) */}
      <div className="kpi-card kpi-blue">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <span className="kpi-count-badge kpi-badge-blue">{activeCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(activeTotal)}</div>
        <div className="kpi-label">Forecast</div>
        <div className="kpi-sub">Billed & in-progress forecast</div>
      </div>

      {/* For Billing */}
      <div className="kpi-card kpi-amber">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className="kpi-count-badge kpi-badge-amber">{pendingCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(pendingTotal)}</div>
        <div className="kpi-label">For Billing</div>
        <div className="kpi-sub">Ready to invoice / For approval</div>
      </div>

      {/* Cancelled / Revised */}
      <div className="kpi-card kpi-red">
        <div className="kpi-card-top">
          <div className="kpi-icon kpi-icon-red" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <span className="kpi-count-badge" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
            {cancelledCount}
          </span>
        </div>
        <div className="kpi-value">{formatCurrency(cancelledTotal)}</div>
        <div className="kpi-label">Cancelled / Revised</div>
        <div className="kpi-sub">Voided or revised bills</div>
      </div>

    </div>
  )
}
