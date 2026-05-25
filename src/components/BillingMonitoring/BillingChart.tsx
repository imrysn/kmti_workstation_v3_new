import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  CartesianGrid
} from 'recharts'
import type { IBillingChartPoint, IStatusStats, IClientSalesPoint } from '../../hooks/useBillingMonitoring'

interface BillingChartProps {
  chartData: IBillingChartPoint[]
  timeframe: 'week' | 'month' | 'year'
  setTimeframe: (t: 'week' | 'month' | 'year') => void
  revenueSum: number
  invoicesCount: number
  trendPercent: number
  timeframeLabel: string
  showCompleted: boolean
  setShowCompleted: (val: boolean) => void
  showApprovedActive: boolean
  setShowApprovedActive: (val: boolean) => void
  showPending: boolean
  setShowPending: (val: boolean) => void
  showCancelled: boolean
  setShowCancelled: (val: boolean) => void
  statusStats: IStatusStats
  currentEndMonth: string
  formatCurrency: (val?: number) => string
  chartView: 'total-sales' | 'client-sales'
  setChartView: (v: 'total-sales' | 'client-sales') => void
  clientColors: Record<string, string>
  clientSalesData: IClientSalesPoint[]
  clientChartData: any[]
  updateClientColor: (clientName: string, color: string) => void
  uniqueYears: number[]
  activeYear: number
  setSelectedYear: (y: number) => void
}

export default function BillingChart({
  chartData,
  timeframe,
  setTimeframe,
  revenueSum,
  invoicesCount,
  trendPercent,
  timeframeLabel,
  showCompleted,
  setShowCompleted,
  showApprovedActive,
  setShowApprovedActive,
  showPending,
  setShowPending,
  showCancelled,
  setShowCancelled,
  statusStats,
  currentEndMonth,
  formatCurrency,
  chartView,
  setChartView,
  clientColors,
  clientSalesData,
  clientChartData,
  updateClientColor,
  uniqueYears,
  activeYear,
  setSelectedYear
}: BillingChartProps) {

  // Totals for all states
  const completedTotal = statusStats['Billing Completion']?.total || 0
  const approvedActiveTotal = (statusStats['Approved']?.total || 0) + (statusStats['Partial Billing']?.total || 0)
  const pendingTotal = statusStats['For Approval']?.total || 0
  const cancelledTotal = statusStats['CANCELLED']?.total || 0

  const createDotRenderer = (color: string, key: string) => (props: any) => {
    const { cx, cy, index } = props
    const isLast = index === chartData.length - 1
    if (isLast) {
      const lastPoint = chartData[index]
      const labelText = lastPoint ? lastPoint.name.toUpperCase() : currentEndMonth
      return (
        <g key={`last-dot-${key}`}>
          <circle cx={cx} cy={cy} r={4} fill="#fff" stroke={color} strokeWidth={2.5} />
          <rect x={cx + 8} y={cy - 9} width={32} height={18} rx={9} fill="var(--bg-secondary)" stroke={color} strokeWidth={1.5} />
          <text x={cx + 24} y={cy + 3} textAnchor="middle" fontSize={8} fontWeight="700" fill={color}>
            {labelText}
          </text>
        </g>
      )
    }
    const shouldRenderDot = timeframe === 'week' ? true : timeframe === 'year' ? true : index % 4 === 0
    if (shouldRenderDot) {
      return (
        <circle key={`dot-${index}-${key}`} cx={cx} cy={cy} r={3} fill="#fff" stroke={color} strokeWidth={1.5} />
      )
    }
    return null
  }

  return (
    <div className="crypto-chart-panel">
      {/* Self-contained styling for new legend lines to maintain decoupling */}
      <style>{`
        .legend-item.completed-line.active {
          border-color: #10b981 !important;
          color: #10b981 !important;
          background: rgba(16, 185, 129, 0.06) !important;
        }
        .legend-item.approved-active-line.active {
          border-color: #10b981 !important;
          color: #10b981 !important;
          background: rgba(16, 185, 129, 0.04) !important;
        }
        .legend-item.pending-line.active {
          border-color: #f59e0b !important;
          color: #f59e0b !important;
          background: rgba(245, 158, 11, 0.06) !important;
        }
        .legend-item.cancelled-line.active {
          border-color: #ef4444 !important;
          color: #ef4444 !important;
          background: rgba(239, 68, 68, 0.06) !important;
        }
        .legend-dot.completed-line { background: #10b981; box-shadow: 0 0 4px #10b981; }
        .legend-dot.approved-active-line {
          background: transparent;
          border: 2px dashed #10b981;
          box-sizing: border-box;
        }
        .legend-dot.pending-line {
          background: transparent;
          border: 2px dashed #f59e0b;
          box-sizing: border-box;
        }
        .legend-dot.cancelled-line {
          background: transparent;
          border: 2px dashed #ef4444;
          box-sizing: border-box;
        }
        .crypto-chart-type-toggles {
          display: flex;
          gap: 4px;
          background: rgba(0, 0, 0, 0.04);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid var(--border);
        }
        [data-theme="dark"] .crypto-chart-type-toggles {
          background: rgba(255, 255, 255, 0.03);
        }
        .crypto-chart-type-toggles button {
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .crypto-chart-type-toggles button.active {
          background: var(--bg-primary);
          color: var(--text-primary);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
        }
        .client-legend-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          padding-top: 16px;
          width: 100%;
        }
        .client-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-primary);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 5px 12px;
          font-weight: 500;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.01);
        }
        .client-color-dot-picker {
          position: relative;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          cursor: pointer;
          border: 1px solid rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
          overflow: hidden;
          transition: transform 0.2s ease;
        }
        .client-color-dot-picker:hover {
          transform: scale(1.15);
        }
        .client-color-dot-picker input[type="color"] {
          position: absolute;
          top: -4px;
          left: -4px;
          width: 20px;
          height: 20px;
          opacity: 0;
          cursor: pointer;
        }
        .client-legend-value {
          font-weight: 700;
          color: var(--text-muted);
          margin-left: 4px;
        }
      `}</style>

      <div className="crypto-chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="crypto-metrics-group">
          <div className="crypto-metric">
            <span className="crypto-metric-value">{invoicesCount}</span>
            <span className="crypto-metric-label">INVOICES</span>
          </div>
          <div className="crypto-metric">
            <span className="crypto-metric-value">{formatCurrency(revenueSum)}</span>
            <span className="crypto-metric-label">
              SALES 
              <span className={`crypto-trend-badge ${trendPercent >= 0 ? 'up' : 'down'}`}>
                {trendPercent >= 0 ? '↑' : '↓'} {Math.abs(trendPercent).toFixed(0)}% {timeframeLabel}
              </span>
            </span>
          </div>
        </div>

        {/* Segmented Toggle Control */}
        <div className="crypto-chart-type-toggles">
          <button 
            className={chartView === 'total-sales' ? 'active' : ''} 
            onClick={() => setChartView('total-sales')}
          >
            Total Sales
          </button>
          <button 
            className={chartView === 'client-sales' ? 'active' : ''} 
            onClick={() => setChartView('client-sales')}
          >
            Sales per Client
          </button>
        </div>

        <div className="crypto-chart-controls" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {(timeframe === 'year' || chartView === 'client-sales') && (
            <div className="crypto-year-selector" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>YEAR:</span>
              <select
                value={activeYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                {uniqueYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {chartView === 'total-sales' && (
            <div className="crypto-timeframe-toggles">
              <button className={timeframe === 'year' ? 'active' : ''} onClick={() => setTimeframe('year')}>YEAR</button>
              <button className={timeframe === 'month' ? 'active' : ''} onClick={() => setTimeframe('month')}>MONTH</button>
              <button className={timeframe === 'week' ? 'active' : ''} onClick={() => setTimeframe('week')}>WEEK</button>
            </div>
          )}
        </div>
      </div>

      <div className="crypto-chart-container" style={{ width: '100%', height: 380 }}>
        {chartView === 'total-sales' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 15, right: 48, left: 8, bottom: 5 }}>
              <defs>
                <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.16}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="approvedActiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.06}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.06}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="cancelledGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.06}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="name"
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
                interval={timeframe === 'month' ? 6 : 0}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(val: number) => {
                  if (val >= 1_000_000) return `¥${(val / 1_000_000).toFixed(1)}M`
                  if (val >= 1_000) return `¥${(val / 1_000).toFixed(0)}K`
                  return `¥${val}`
                }}
              />
              <ChartTooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
                }}
                labelFormatter={(label, items) => {
                  if (items && items[0]) return items[0].payload.displayDate || label
                  return label
                }}
                formatter={(value: any, name: any) => {
                  const labels: Record<string, string> = {
                    completed:      '↑ Billing Completed',
                    approvedActive: '→ Approved & Active',
                    pending:        '• Pending Approval',
                    cancelled:      '↓ Cancelled'
                  }
                  return [`¥${Number(value).toLocaleString()}`, labels[name] || name]
                }}
              />

              {showCancelled && (
                <Area
                  type="monotone"
                  dataKey="cancelled"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeOpacity={0.5}
                  fillOpacity={1}
                  fill="url(#cancelledGradient)"
                  dot={createDotRenderer('#ef4444', 'cancelled')}
                  activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2, fill: '#fff' }}
                />
              )}

              {showPending && (
                <Area
                  type="monotone"
                  dataKey="pending"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeOpacity={0.5}
                  fillOpacity={1}
                  fill="url(#pendingGradient)"
                  dot={createDotRenderer('#f59e0b', 'pending')}
                  activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2, fill: '#fff' }}
                />
              )}

              {showApprovedActive && (
                <Area
                  type="monotone"
                  dataKey="approvedActive"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  strokeOpacity={0.5}
                  fillOpacity={1}
                  fill="url(#approvedActiveGradient)"
                  dot={createDotRenderer('#10b981', 'approvedActive')}
                  activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                />
              )}

              {showCompleted && (
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#completedGradient)"
                  dot={createDotRenderer('#10b981', 'completed')}
                  activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={clientChartData}
              margin={{ top: 15, right: 48, left: 8, bottom: 5 }}
              barCategoryGap="20%"
              barGap={2}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="name"
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
                interval={0}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(val: number) => {
                  if (val >= 1_000_000) return `¥${(val / 1_000_000).toFixed(1)}M`
                  if (val >= 1_000) return `¥${(val / 1_000).toFixed(0)}K`
                  return `¥${val}`
                }}
              />
              <ChartTooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
                }}
                labelFormatter={(label, items) => {
                  if (items && items[0]) return items[0].payload.displayDate || label
                  return label
                }}
                formatter={(value: any, name: any) => [
                  `¥${Number(value).toLocaleString()}`,
                  name
                ]}
              />
              {clientSalesData.map((client) => (
                <Bar
                  key={client.name}
                  dataKey={client.name}
                  fill={clientColors[client.name] || '#3b82f6'}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend Toggles */}
      {chartView === 'total-sales' ? (
        <div className="crypto-chart-legend">
          <button
            className={`legend-item completed-line ${showCompleted ? 'active' : ''}`}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            <span className="legend-dot completed-line"></span>
            <span className="legend-text">
              ↑ Billing Completed — {formatCurrency(completedTotal)}
            </span>
          </button>
          <button
            className={`legend-item approved-active-line ${showApprovedActive ? 'active' : ''}`}
            onClick={() => setShowApprovedActive(!showApprovedActive)}
          >
            <span className="legend-dot approved-active-line"></span>
            <span className="legend-text">
              → Approved & Active — {formatCurrency(approvedActiveTotal)}
            </span>
          </button>
          <button
            className={`legend-item pending-line ${showPending ? 'active' : ''}`}
            onClick={() => setShowPending(!showPending)}
          >
            <span className="legend-dot pending-line"></span>
            <span className="legend-text">
              • Pending Approval — {formatCurrency(pendingTotal)}
            </span>
          </button>
          <button
            className={`legend-item cancelled-line ${showCancelled ? 'active' : ''}`}
            onClick={() => setShowCancelled(!showCancelled)}
          >
            <span className="legend-dot cancelled-line"></span>
            <span className="legend-text">
              ↓ Cancelled — {formatCurrency(cancelledTotal)}
            </span>
          </button>
        </div>
      ) : (
        <div className="client-legend-container">
          {clientSalesData.map((client, idx) => {
            const color = clientColors[client.name] || '#3b82f6'
            return (
              <div key={`client-legend-${idx}`} className="client-legend-item">
                <div className="client-color-dot-picker" style={{ backgroundColor: color }}>
                  <input 
                    type="color" 
                    value={color} 
                    onChange={(e) => updateClientColor(client.name, e.target.value)} 
                  />
                </div>
                <span>{client.name}</span>
                <span className="client-legend-value">{formatCurrency(client.sales)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
