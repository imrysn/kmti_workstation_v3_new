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
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
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
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
          <span className="kpi-count-badge kpi-badge-blue">{activeCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(activeTotal)}</div>
        <div className="kpi-label">Forecast</div>
        <div className="kpi-sub">Billed & in-progress forecast</div>
      </div>

      {/* For Billing */}
      <div className="kpi-card kpi-amber">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
          <span className="kpi-count-badge kpi-badge-amber">{pendingCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(pendingTotal)}</div>
        <div className="kpi-label">For Billing</div>
        <div className="kpi-sub">Ready to invoice / For approval</div>
      </div>

      {/* Cancelled / Revised */}
      <div className="kpi-card kpi-red">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
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
