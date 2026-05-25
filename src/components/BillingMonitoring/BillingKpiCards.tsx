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
  totalItems,
  revenueSum,
  trendPercent,
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

  const trendUp = trendPercent >= 0

  return (
    <div className={vertical ? "billing-kpi-column" : "billing-kpi-row"}>

      {/* Total Sales */}
      <div className="kpi-card kpi-green">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
          <span className={`kpi-trend ${trendUp ? 'up' : 'down'}`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trendPercent).toFixed(0)}%
          </span>
        </div>
        <div className="kpi-value">{formatCurrency(revenueSum)}</div>
        <div className="kpi-label">Total Sales</div>
        <div className="kpi-sub">{totalItems} quotation{totalItems !== 1 ? 's' : ''} in view</div>
      </div>

      {/* Completed / Collected */}
      <div className="kpi-card kpi-purple">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
          <span className="kpi-count-badge kpi-badge-purple">{completedCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(completedTotal)}</div>
        <div className="kpi-label">Billing Completed</div>
        <div className="kpi-sub">Fully collected</div>
      </div>

      {/* Approved & Active */}
      <div className="kpi-card kpi-blue">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
          <span className="kpi-count-badge kpi-badge-blue">{activeCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(activeTotal)}</div>
        <div className="kpi-label">Approved & Active</div>
        <div className="kpi-sub">In progress</div>
      </div>

      {/* Pending Approval */}
      <div className="kpi-card kpi-amber">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }}>
          <span className="kpi-count-badge kpi-badge-amber">{pendingCount}</span>
        </div>
        <div className="kpi-value">{formatCurrency(pendingTotal)}</div>
        <div className="kpi-label">Pending Approval</div>
        <div className="kpi-sub">Awaiting review</div>
      </div>

      {/* Cancelled */}
      <div className="kpi-card kpi-red">
        <div className="kpi-card-top" style={{ justifyContent: 'flex-end' }} />
        <div className="kpi-value kpi-value-sm">{cancelledCount}</div>
        <div className="kpi-label">Cancelled</div>
        <div className="kpi-sub">Voided quotations</div>
      </div>

    </div>
  )
}
